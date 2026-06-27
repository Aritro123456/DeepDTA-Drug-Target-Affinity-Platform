import os
import time

import numpy as np
from flask import Flask
from flask_cors import CORS

from .config import Config, FRONTEND_DIR, UPLOAD_DIR, get_cors_origins
from .extensions import db
from .routes import register_blueprints
from .security import protect_csrf
from .services.notebook_runtime import initialize_notebook_runtime


if not hasattr(np, "float"):
    np.float = float
if not hasattr(np, "int"):
    np.int = int
if not hasattr(np, "bool"):
    np.bool = bool


def initialize_database(app):
    retries = int(os.environ.get("DB_CONNECT_RETRIES", "1"))
    delay = float(os.environ.get("DB_CONNECT_DELAY", "2"))

    with app.app_context():
        last_error = None
        for attempt in range(1, retries + 1):
            try:
                db.create_all()
                print(f"Database tables initialized successfully using {app.config['SQLALCHEMY_DATABASE_URI']}")
                return
            except Exception as e:
                last_error = e
                print(f"Database initialization attempt {attempt}/{retries} failed: {e}")
                if attempt < retries:
                    time.sleep(delay)

        print(f"Database error during initialization: {last_error}")


def create_app():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    flask_app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
    flask_app.config.from_object(Config)

    CORS(
        flask_app,
        resources={r"/*": {"origins": get_cors_origins()}},
        supports_credentials=True,
    )

    db.init_app(flask_app)
    flask_app.before_request(protect_csrf)

    register_blueprints(flask_app)
    initialize_database(flask_app)
    initialize_notebook_runtime(flask_app)

    return flask_app


app = create_app()


if __name__ == "__main__":
    flask_host = os.environ.get("FLASK_HOST", "127.0.0.1")
    flask_port = int(os.environ.get("FLASK_PORT", "5000"))
    flask_debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"Starting DeepDTA Web Server on http://{flask_host}:{flask_port}")
    app.run(host=flask_host, port=flask_port, debug=flask_debug)
