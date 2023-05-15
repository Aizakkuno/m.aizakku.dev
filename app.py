import random
import string
import time

from copy import deepcopy

from flask import Flask, request, render_template, session
from flask_socketio import SocketIO, send, emit, join_room

from toolbox import json_key, sio_key

app = Flask(__name__)
app.config["SECRET_KEY"] = "y-WVUa-YRIAZUwiBqiMAQAPAn-tZVQAt"
app.config["TEMPLATES_AUTO_RELOAD"] = True

socketio = SocketIO(app)

users = {"Test User 1": {"status": "available", "client_id": None, "refreshed": time.time() + 10, "secret": "123"}}

def generate_code():
    return "".join(random.choices(string.digits, k=4))


def generate_id():
    return "".join(random.choices(string.ascii_letters + string.digits, k=6))


def generate_secret():
    return "".join(random.choices(string.ascii_letters
                                  + string.digits
                                  + "-", k=64))


def sgenerate_id():
    user_id = generate_id()
    while users.get(user_id):
        user_id = generate_id()

    return user_id


def sgenerate_secret():
    user_found = True

    while user_found:
        user_found = False

        secret = generate_secret()

        for user in users.values():
            if secret == user["secret"]:
                user_found = True

    return secret


@app.route("/")
def index_view():
    return render_template("index.html")


@app.route("/api/connected", methods=["POST"])
@json_key("secret", 64, 64)
def api_connected(secret):
    for user in users.values():
        if secret == user["secret"]:
            user_list = deepcopy(users)

            for user_obj in user_list.values():
                user_obj.pop("secret")

            return {"users": user_list}, 200

    return {"error": "unregistered"}, 401


@app.route("/api/message/request", methods=["POST"])
@json_key("secret", 64, 64)
@json_key("public_key")
@json_key("client_id")
def api_message_request(secret, client_id, public_key):
    user = None

    for user_id, user_obj in users.items():
        if secret == user_obj["secret"]:
            user = user_obj
            break

    if not user:
        return {"error": "unregistered"}, 401
    
    if user["status"] != "available":
        return {"error": "user_busy"}, 403
    
    client = users.get(client_id)
    if not client:
        return {"error": "client_not_found"}, 404
    
    if client["status"] != "available":
        return {"error": "client_busy"}, 403
    
    user["status"] = "request"
    client["status"] = "request"

    user["client_id"] = client_id
    client["client_id"] = user_id
    
    socketio.emit("request-client", {"client_id": user_id,
                                     "public_key": public_key}, to=client_id)
    
    return {}, 200


@app.route("/api/message/accept", methods=["POST"])
@json_key("secret", 64, 64)
@json_key("public_key")
def api_message_accept(secret, public_key):
    user = None

    for user_id, user_obj in users.items():
        if secret == user_obj["secret"]:
            user = user_obj
            break

    if not user:
        return {"error": "unregistered"}, 401
    
    if user["status"] != "request":
        return {"error": "user_busy"}, 403
    
    client_id = user["client_id"]
    
    client = users.get(client_id)
    if not client:
        user["status"] = "available"

        return {"error": "client_not_found"}, 404
    
    if not client["client_id"] == user_id or client["status"] == "busy":
        return {"error": "client_busy"}, 403
    
    user["status"] = "busy"
    client["status"] = "busy"
    
    socketio.emit("accept-client", {"public_key": public_key}, to=client_id)

    return {}, 200


@app.route("/api/message/exit", methods=["POST"])
@json_key("secret", 64, 64)
def api_message_exit(secret):
    user = None

    for user_id, user_obj in users.items():
        if secret == user_obj["secret"]:
            user = user_obj
            break

    if not user:
        return {"error": "unregistered"}, 401
    
    if user["status"] == "available":
        return {"error": "user_available"}, 403
    
    client_id = user["client_id"]

    # need to broadcast so frontend can see as available
    
    client = users.get(client_id)
    if client and client["client_id"] == user_id:
        client["status"] = "available"

        socketio.emit("exit-client", to=client_id)
    
    user["status"] = "available"
    
    return {}, 200


@app.route("/api/message/send", methods=["POST"])
@json_key("secret", 64, 64)
@json_key("message")
def api_message_send(secret, message):
    user = None

    for user_id, user_obj in users.items():
        if secret == user_obj["secret"]:
            user = user_obj
            break

    if not user:
        return {"error": "unregistered"}, 401
    
    client_id = user["client_id"]
    
    client = users.get(client_id)
    if not client:
        user["status"] = "available"

        return {"error": "client_not_found"}, 404
    
    if not (client["client_id"] == user_id and client["status"] == "busy"):
        return {"error": "not_accepted"}, 403
    
    socketio.emit("message-client", {"client_id": user_id,
                                     "message": message}, to=client_id)
    
    print(message)
    
    return {}, 200


@socketio.on("connected-server")
def connected():
    secret = sgenerate_secret()

    session["secret"] = secret

    user_id = sgenerate_id()

    users[user_id] = {"status": "available",
                      "client_id": None,
                      "refreshed": time.time(),
                      "secret": secret}

    join_room(user_id)

    emit("connected-client", {"secret": secret, "user_id": user_id})

    emit("connected-client:broadcast",
         {"client_id": user_id},
         broadcast=True,
         include_self=False)
    

@socketio.on("refresh-server")
@sio_key("secret", 64, 64)
def refresh(json, secret):
    user = None

    for user_id, user_obj in users.items():
        if secret == user_obj["secret"]:
            user = user_obj
            break

    if not user:
        return emit("refresh-client:error", {"error": "unregistered"})
    
    join_room(user_id)

    user["refreshed"] = time.time()


def expire_loop():
    while True:
        for user_id in list(users):
            if users[user_id]["refreshed"] < time.time() - 5:
                client_id = users[user_id]["client_id"]

                client = users.get(client_id)
                if client:
                    client["status"] = "available"
                    client["client_id"] = None

                socketio.emit("disconnected-client-broadcast",
                              {"client_id": user_id})

                users.pop(user_id)

        time.sleep(1)

socketio.start_background_task(expire_loop)

# @socketio.on("disconnect")
# def disconnect():
#     try:
#         users.pop(request.remote_addr)

#         emit("disconnected-client:broadcast",
#              {"ip": request.remote_addr},
#              broadcast=True)
#     except:
#         pass

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0")