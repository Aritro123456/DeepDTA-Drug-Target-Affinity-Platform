import json
import os
import urllib.request

from flask import Blueprint, jsonify

from ..config import MODEL_SERVICE_URL


health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health():
    model_status = {"available": False, "model_loaded": False}
    sandbox_status = {
        "available": False,
        "enabled": os.environ.get("NOTEBOOK_EXECUTION_ENABLED", "false").lower() == "true",
    }

    try:
        req = urllib.request.Request(f"{MODEL_SERVICE_URL}/health", method="GET")
        with urllib.request.urlopen(req, timeout=3) as response:
            model_status = json.loads(response.read().decode("utf-8"))
            model_status["available"] = True
    except Exception:
        pass

    sandbox_url = os.environ.get("SANDBOX_EXECUTOR_URL")
    if sandbox_url:
        try:
            req = urllib.request.Request(f"{sandbox_url.rstrip('/')}/health", method="GET")
            with urllib.request.urlopen(req, timeout=3) as response:
                sandbox_status.update(json.loads(response.read().decode("utf-8")))
                sandbox_status["available"] = True
        except Exception:
            pass

    return jsonify({
        "status": "healthy",
        "model_service": model_status,
        "model_loaded": model_status.get("model_loaded", False),
        "sandbox": sandbox_status,
    }), 200
