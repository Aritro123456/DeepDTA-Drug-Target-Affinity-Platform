import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from flask import jsonify

from ..config import (
    MODEL_SERVICE_AUTO_START,
    MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS,
    MODEL_SERVICE_TOKEN,
    MODEL_SERVICE_TOKEN_HEADER,
    MODEL_SERVICE_URL,
    PROJECT_ROOT,
)


_startup_lock = threading.Lock()
_startup_process = None


def _headers(payload=None):
    headers = {}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if MODEL_SERVICE_TOKEN:
        headers[MODEL_SERVICE_TOKEN_HEADER] = MODEL_SERVICE_TOKEN
    return headers


def _is_local_model_service():
    parsed = urllib.parse.urlparse(MODEL_SERVICE_URL)
    return parsed.hostname in {"127.0.0.1", "localhost"} and parsed.port == 5051


def _service_is_healthy(timeout=2):
    req = urllib.request.Request(
        f"{MODEL_SERVICE_URL}/health",
        headers=_headers(),
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def _start_local_model_service():
    global _startup_process

    if not MODEL_SERVICE_AUTO_START or not _is_local_model_service():
        return False

    with _startup_lock:
        if _service_is_healthy():
            return True

        if _startup_process is not None and _startup_process.poll() is None:
            return True

        script_path = os.path.join(PROJECT_ROOT, "start_model_service.bat")
        if not os.path.exists(script_path):
            return False

        startupinfo = None
        creationflags = 0
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        _startup_process = subprocess.Popen(
            [script_path],
            cwd=PROJECT_ROOT,
            startupinfo=startupinfo,
            creationflags=creationflags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    deadline = time.time() + MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS
    while time.time() < deadline:
        if _service_is_healthy():
            return True
        time.sleep(1)

    return False


def call_model_service(path, query=None, method="GET", payload=None, timeout=120):
    url = f"{MODEL_SERVICE_URL}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    headers = _headers(payload)

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
            return jsonify(body), response.status
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {"success": False, "error": "Model service request failed."}
        return jsonify(body), e.code
    except Exception as e:
        if _start_local_model_service():
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    body = json.loads(response.read().decode("utf-8"))
                    return jsonify(body), response.status
            except Exception as retry_error:
                e = retry_error

        return jsonify({
            "success": False,
            "error": f"Model service unavailable: {e}"
        }), 503
