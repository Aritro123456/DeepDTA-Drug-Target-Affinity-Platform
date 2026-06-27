import secrets
import time
from collections import defaultdict, deque
from functools import wraps

from flask import jsonify, request, session

from .extensions import db
from .models import User


CSRF_EXEMPT_ENDPOINTS = {"login", "register", "csrf_token"}
RATE_LIMIT_BUCKETS = defaultdict(deque)


def endpoint_name(endpoint):
    return (endpoint or "").rsplit(".", 1)[-1]


def client_rate_key(label):
    user_id = session.get("user_id")
    if user_id:
        identity = f"user:{user_id}"
    else:
        identity = request.remote_addr or "unknown"
    return f"{label}:{identity}"


def rate_limit(label, max_requests, window_seconds):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            now = time.time()
            bucket = RATE_LIMIT_BUCKETS[client_rate_key(label)]
            while bucket and bucket[0] <= now - window_seconds:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                return jsonify({
                    "success": False,
                    "error": "Too many requests. Please wait and try again."
                }), 429, {"Retry-After": str(retry_after)}

            bucket.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def protect_csrf():
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None
    if endpoint_name(request.endpoint) in CSRF_EXEMPT_ENDPOINTS:
        return None

    expected_token = session.get("csrf_token")
    provided_token = request.headers.get("X-CSRF-Token")
    if not expected_token or not provided_token or not secrets.compare_digest(expected_token, provided_token):
        return jsonify({"success": False, "error": "Invalid or missing CSRF token"}), 403

    return None


def current_user_id():
    return session.get("user_id")


def require_login():
    user_id = current_user_id()
    if not user_id:
        return None, (jsonify({"success": False, "error": "Authentication required"}), 401)
    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return None, (jsonify({"success": False, "error": "Authentication required"}), 401)
    return user, None
