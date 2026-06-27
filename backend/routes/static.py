import os

from flask import Blueprint, send_from_directory

from ..config import FRONTEND_DIR


static_bp = Blueprint("static_routes", __name__)


@static_bp.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@static_bp.route("/<path:filename>")
def serve_static(filename):
    requested_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.exists(requested_path) and not os.path.isdir(requested_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return index()
