from flask import Blueprint, jsonify, session, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User
from ..security import get_csrf_token, rate_limit, require_login


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/register", methods=["POST"])
@rate_limit("register", 5, 900)
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "error": "User already exists"}), 400

    new_user = User(
        email=email,
        password_hash=generate_password_hash(password)
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"success": True, "message": "User registered successfully"}), 201


@auth_bp.route("/api/login", methods=["POST"])
@rate_limit("login", 10, 900)
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        session.clear()
        session["user_id"] = user.id
        return jsonify({
            "success": True,
            "user": {"email": user.email}
        }), 200

    return jsonify({"success": False, "error": "Invalid credentials"}), 401


@auth_bp.route("/api/csrf-token", methods=["GET"])
def csrf_token():
    return jsonify({"success": True, "csrf_token": get_csrf_token()}), 200


@auth_bp.route("/api/me", methods=["GET"])
def me():
    user, error = require_login()
    if error:
        return error
    return jsonify({"success": True, "user": {"email": user.email}}), 200


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out"}), 200
