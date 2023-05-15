import { aCrypto } from "./aCrypto.js";
import { io } from "./socket.io.esm.min.js";

const rsa = await new aCrypto.rsaObject();;
const socket = io();

// dec2hex :: Integer -> String
// i.e. 0-255 -> '00'-'ff'
function dec2hex (dec) {
    return dec.toString(16).padStart(2, "0");
}
  
// generateId :: Integer -> String
function generateId (len) {
    var arr = new Uint8Array((len || 40) / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
}

let secret;
let userID;

let state = "available";
let currentClient;
let clientRSA;

let clientContainer;
let overlay;
let waitPrompt;
let waitMessage;
let requestPrompt;
let requestMessage;
let messagingContainer;
let messagesContainer;
let messageInput;
let clientDisplay;

String.prototype.escape = function() {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    return this.replace(/[&<>]/g, function(tag) {
        return tagsToReplace[tag] || tag;
    });
};

// const waitToLoad = async () => {
//     return new Promise((resolve, reject) => {
//         setInterval(() => {
//             if (document.readyState === "complete") {
//                 resolve();
//             }
//         }, 100);
//     });
// }

socket.on("disconnect", () => {
    console.log("disconnect!")
});

socket.on("disconnected-client-broadcast", async (data) => {
    document.getElementById(data.client_id).remove();

    if (currentClient == data.client_id) {
        state = "available";
        overlay.style.display = "none";
        waitPrompt.style.display = "none";
        requestPrompt.style.display = "none";
        messagingContainer.style.display = "none";
        messagesContainer.innerHTML = "";
    } else if (userID == data.client_id) {
        state = "available";
        overlay.style.display = "none";
        waitPrompt.style.display = "none";
        requestPrompt.style.display = "none";
        messagingContainer.style.display = "none";
        messagesContainer.innerHTML = "";

        socket.emit("connected-server");
    }
});

socket.on("connected-client:broadcast", async (data) => {
    const html = `<div id="${data.client_id}" class="padded">
                      <span class="green circle"></span>
                      <p class="client-id">${data.client_id}</p>
                      <button class="request-button"
                          data-client-id="${data.client_id}">Request
                      </button>
                  </div>`

    clientContainer.insertAdjacentHTML("beforeend", html);
});

socket.once("connected-client:error", (data) => {
    return console.error(`Error in connecting: ${data.error}`);
});

socket.once("connected-client", async (data) => {
    secret = data.secret;
    userID = data.user_id;

    setInterval(() => {
        socket.emit("refresh-server", {"secret": secret});
    }, 2000);

    let reqData = {method: "POST",
                   headers: {"Content-Type": "application/json"},
                   body: JSON.stringify({"secret": secret})};

    let response = await fetch("/api/connected", reqData);

    let responseData = await response.json();

    for (const clientID of Object.keys(responseData.users)) {
        if (clientID == userID) continue;

        const status = responseData.users[clientID].status;

        const color = status == "available" ? "green" : "red";

        const html = `<div id="${clientID}" class="padded">
                          <span class="${color} circle"></span>
                          <p class="client-id">${clientID}</p>
                          <button class="request-button"
                                  data-client-id="${clientID}">Request
                          </button>
                      </div>`

        clientContainer.insertAdjacentHTML("beforeend", html);
    }
});

socket.on("request-client", async (data) => {
    state = "request";
    currentClient = data.client_id;
    clientRSA = await new aCrypto.rsaObject(data.public_key);

    requestMessage.innerText = `Message start request from ${data.client_id}.`;

    overlay.style.display = "flex";
    requestPrompt.style.display = "block";
});

socket.on("exit-client", () => {
    state = "available";
    overlay.style.display = "none";
    waitPrompt.style.display = "none";
    requestPrompt.style.display = "none";
    messagingContainer.style.display = "none";
    messagesContainer.innerHTML = "";
});

socket.on("accept-client", async (data) => {
    state = "busy";

    clientRSA = await new aCrypto.rsaObject(data.public_key);

    messageInput.value = "";
    clientDisplay.innerText = currentClient;

    waitPrompt.style.display = "none";
    requestPrompt.style.display = "none";
    messagingContainer.style.display = "flex";
});

socket.on("message-client", async (data) => {
    let decryptedMessage = await rsa.decrypt(data.message);
    let sanitizedMessage = decryptedMessage.escape();

    console.log(decryptedMessage);

    let html = `<div class="message-container">
                    <div class="message">${sanitizedMessage}</div>
                </div>`;

    messagesContainer.insertAdjacentHTML("beforeend", html);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

const loadInterval = setInterval(() => {
    if (document.readyState === "complete") {
        clientContainer = document.getElementById("client-container");
        overlay = document.getElementById("overlay");
        waitPrompt = document.getElementById("wait-prompt");
        waitMessage = document.getElementById("wait-message");
        requestPrompt = document.getElementById("request-prompt");
        requestMessage = document.getElementById("request-message");
        messagingContainer = document.getElementById("message-container");
        messageInput = document.getElementById("message-input");
        messagesContainer = document.getElementById("messages-container");
        clientDisplay = document.getElementById("client-message-id");

        document.addEventListener("click", async (event) => {
            const button = event.target;
            if (button.className == "request-button") {
                state = "request";
                currentClient = button.getAttribute("data-client-id");

                let body = {"secret": secret,
                            "client_id": currentClient,
                            "public_key": await rsa.getPublicKey()};

                let reqData = {method: "POST",
                               headers: {"Content-Type": "application/json"},
                               body: JSON.stringify(body)};

                let response = await fetch("/api/message/request", reqData);

                let responseData = await response.json();

                if (response.status != 200) {
                    console.error(`Failed to send message request: ${responseData.error}`);
                }

                waitMessage.innerText = `Waiting for ${currentClient} to accept message request...`;

                overlay.style.display = "flex";
                waitPrompt.style.display = "block";
            }

            if (button.id == "wait-exit-button"
                || button.id == "decline-button"
                || button.id == "message-exit-button") {

                state = "available";
                overlay.style.display = "none";
                waitPrompt.style.display = "none";
                requestPrompt.style.display = "none";
                messagingContainer.style.display = "none";
                messagesContainer.innerHTML = "";

                let reqData = {method: "POST",
                               headers: {"Content-Type": "application/json"},
                               body: JSON.stringify({"secret": secret})};

                let response = await fetch("/api/message/exit", reqData);

                let responseData = await response.json();

                if (response.status != 200) {
                    return console.error(`Failed to exit request: ${responseData.error}`);
                }
            }

            if (button.id == "accept-button") {
                let body = {"secret": secret,
                            "public_key": await rsa.getPublicKey()};

                let reqData = {method: "POST",
                               headers: {"Content-Type": "application/json"},
                               body: JSON.stringify(body)};

                let response = await fetch("/api/message/accept", reqData);

                let responseData = await response.json();

                if (response.status != 200) {
                    return console.error(`Failed to accept request: ${responseData.error}`);
                }

                state = "busy";

                messageInput.value = "";
                clientDisplay.innerText = currentClient;

                requestPrompt.style.display = "none";

                messagingContainer.style.display = "flex";
            }
        });

        document.addEventListener("keypress", async (event) => {
            console.log(state);
            if (event.key == "Enter" && state == "busy") {
                let encryptedMessage = await clientRSA.encrypt(messageInput.value);
                let sanitizedMessage = messageInput.value.escape();

                messageInput.value = "";

                let messageID = generateId(10);

                let html = `<div class="message-container">
                                <div class="pusher"></div>
                                <div id="${messageID}" class="message">${sanitizedMessage}</div>
                            </div>`;
        
                messagesContainer.insertAdjacentHTML("beforeend", html);
        
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
                let body = {"secret": secret, "message": encryptedMessage};
        
                let reqData = {method: "POST",
                               headers: {"Content-Type": "application/json"},
                               body: JSON.stringify(body)};
        
                let response = await fetch("/api/message/send", reqData);
        
                let responseData = await response.json();

                let messageElement = document.getElementById(messageID);

                messageElement.style.color = "#f1f3f5";
        
                if (response.status != 200) {
                    messageElement.style.backgroundColor = "#d6336c";

                    return console.error(`Failed to send message: ${responseData.error}`);
                }

                messageElement.style.backgroundColor = "#339af0";
            }
        });

        socket.emit("connected-server");

        clearInterval(loadInterval);
    }
}, 100)