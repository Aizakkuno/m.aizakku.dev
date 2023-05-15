import string

import json as JSON

from flask import request, session
from flask_socketio import emit

from functools import wraps

def json_key(key,
             min: int = 1,
             max: int = 4096,
             var_type: type = str,
             required: bool = True,
             printable: bool = True):

    def wrapper(f):
        @wraps(f)
        def wrapper_function(*args, **kwargs):
            if request.json:
                value = request.json.get(key)
                if not value and required:
                    return {"text": f"Please specify a value for '{key}'!",
                            "error": f"invalid_{key}"}, 400
                elif not required:
                    value = value or None
            else:
                if required:
                    return {"text": "Bad request!",
                            "error": "bad_request"}, 400
                else:
                    value = None

            if value:
                if not isinstance(value, var_type):
                    try:
                        value = var_type(value)
                    except ValueError:
                        return {"text": (f"Value for '{key}' must be type "
                                         f"{var_type.__name__}!"),
                                "error": f"invalid_{key}"}, 400

                if len(str(value)) < min:
                    return {"text": (f"Value for '{key}' must be at least "
                                     f"{min} characters!"),
                            "error": f"invalid_{key}"}, 400

                if len(str(value)) > max:
                    return {"text": (f"Value for '{key}' must be at most "
                                     f"{max} characters!"),
                            "error": f"invalid_{key}"}, 400

                if printable and isinstance(value, str):
                    for chr in value:
                        if chr not in string.printable:
                            return {"text": (f"Value for '{key}' uses "
                                             "invalid characters!"),
                                    "error": f"invalid_{key}"}, 400

            return f(**{key: value}, **kwargs)
        return wrapper_function
    return wrapper


def sio_key(key,
            min: int = 1,
            max: int = 4096,
            var_type: type = str,
            required: bool = True,
            printable: bool = True):

    def wrapper(f):
        @wraps(f)
        def wrapper_function(json, *args, **kwargs):
            # if data sent as string by mistake, may be good to type check
            # and cast potentially

            if json:
                if not isinstance(json, object):
                    try:
                        #ehh maybe just change the name json to data
                        value = JSON.loads(json)
                    except ValueError:
                        return emit("error", {"text": (f"Value for '{key}' "
                                                       "must be type "
                                                       f"{var_type.__name__}!"),
                                              "error": f"invalid_{key}",
                                              "response": "error"})

                value = json.get(key)
                if not value and required:
                    return emit("error", {"text": ("Please specify a value "
                                                   f"for '{key}'!"),
                                          "error": f"invalid_{key}",
                                          "response": "error"})
                elif not required:
                    value = value or None
            else:
                if required:
                    return emit("error", {"text": "Bad request!",
                                          "error": "bad_request",
                                          "response": "error"})
                else:
                    value = None

            if value:
                if not isinstance(value, var_type):
                    try:
                        value = var_type(value)
                    except ValueError:
                        return emit("error", {"text": (f"Value for '{key}' "
                                                       "must be type "
                                                       f"{var_type.__name__}!"),
                                              "error": f"invalid_{key}",
                                              "response": "error"})

                if len(str(value)) < min:
                    return emit("error", {"text": (f"Value for '{key}' must "
                                                   f"be at least {min} "
                                                   "characters!"),
                                          "error": f"invalid_{key}",
                                          "response": "error"})

                if len(str(value)) > max:
                    return emit("error", {"text": (f"Value for '{key}' must "
                                                   f"be at most {max} "
                                                   "characters!"),
                                          "error": f"invalid_{key}",
                                          "response": "error"})

                if printable and isinstance(value, str):
                    for chr in value:
                        if chr not in string.printable:
                            return emit("error", {"text": ("Value for "
                                                           f"'{key}' uses "
                                                           "invalid "
                                                           "characters!"),
                                                  "error": f"invalid_{key}",
                                                  "response": "error"})

            return f(json, **{key: value}, **kwargs)
        return wrapper_function
    return wrapper


# def session_sio_key(key,
#             min: int = 1,
#             max: int = 4096,
#             var_type: type = str,
#             required: bool = True,
#             printable: bool = True):

#     def wrapper(f):
#         @wraps(f)
#         def wrapper_function(*args, **kwargs):
#             # if data sent as string by mistake, may be good to type check
#             # and cast potentially

#             if session:
#                 if not isinstance(session, object):
#                     try:
#                         #ehh maybe just change the name json to data
#                         value = JSON.loads(json)
#                     except ValueError:
#                         return emit("error", {"text": (f"Value for '{key}' "
#                                                        "must be type "
#                                                        f"{var_type.__name__}!"),
#                                               "error": f"invalid_{key}",
#                                               "response": "error"})

#                 value = session.get(key)
#                 if not value and required:
#                     return emit("error", {"text": ("Please specify a value "
#                                                    f"for '{key}'!"),
#                                           "error": f"invalid_{key}",
#                                           "response": "error"})
#                 elif not required:
#                     value = value or None
#             else:
#                 if required:
#                     return emit("error", {"text": "Bad request!",
#                                           "error": "bad_request",
#                                           "response": "error"})
#                 else:
#                     value = None

#             if value:
#                 if not isinstance(value, var_type):
#                     try:
#                         value = var_type(value)
#                     except ValueError:
#                         return emit("error", {"text": (f"Value for '{key}' "
#                                                        "must be type "
#                                                        f"{var_type.__name__}!"),
#                                               "error": f"invalid_{key}",
#                                               "response": "error"})

#                 if len(str(value)) < min:
#                     return emit("error", {"text": (f"Value for '{key}' must "
#                                                    f"be at least {min} "
#                                                    "characters!"),
#                                           "error": f"invalid_{key}",
#                                           "response": "error"})

#                 if len(str(value)) > max:
#                     return emit("error", {"text": (f"Value for '{key}' must "
#                                                    f"be at most {max} "
#                                                    "characters!"),
#                                           "error": f"invalid_{key}",
#                                           "response": "error"})

#                 if printable and isinstance(value, str):
#                     for chr in value:
#                         if chr not in string.printable:
#                             return emit("error", {"text": ("Value for "
#                                                            f"'{key}' uses "
#                                                            "invalid "
#                                                            "characters!"),
#                                                   "error": f"invalid_{key}",
#                                                   "response": "error"})

#             return f(json, **{key: value}, **kwargs)
#         return wrapper_function
#     return wrapper