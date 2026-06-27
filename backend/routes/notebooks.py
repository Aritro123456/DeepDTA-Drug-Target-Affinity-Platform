import json
import os
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Notebook
from ..security import require_login


notebooks_bp = Blueprint("notebooks", __name__)


@notebooks_bp.route("/upload_notebook", methods=["POST"])
def upload_notebook():
    user, error = require_login()
    if error:
        return error

    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided in request"}), 400

    file = request.files["file"]
    filename = file.filename or ""
    if not filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    try:
        content = file.read().decode("utf-8")

        if filename.endswith(".ipynb"):
            nb = json.loads(content)
            raw_cells = nb.get("cells", [])
            parsed_cells = []
            for c in raw_cells:
                cell_type = c.get("cell_type", "code")
                source = c.get("source", [])
                if isinstance(source, list):
                    source = "".join(source)
                parsed_cells.append({
                    "type": cell_type,
                    "source": source
                })
            return jsonify({
                "success": True,
                "format": "ipynb",
                "filename": filename,
                "cells": parsed_cells
            }), 200

        if filename.endswith(".py"):
            return jsonify({
                "success": True,
                "format": "py",
                "filename": filename,
                "cells": [{"type": "code", "source": content}]
            }), 200

        return jsonify({
            "success": False,
            "error": "Unsupported file type. Please upload a .ipynb or .py file."
        }), 400

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@notebooks_bp.route("/api/execute", methods=["POST"])
def execute_code():
    user, error = require_login()
    if error:
        return error

    if os.environ.get("NOTEBOOK_EXECUTION_ENABLED", "false").lower() != "true":
        return jsonify({
            "success": False,
            "error": "Notebook execution is disabled. Enable the sandbox service to run code."
        }), 403

    sandbox_url = os.environ.get("SANDBOX_EXECUTOR_URL")
    if not sandbox_url:
        return jsonify({
            "success": False,
            "error": "Sandbox executor URL is not configured."
        }), 503

    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    if not code:
        return jsonify({"success": False, "error": "No code provided"}), 400

    payload = json.dumps({"code": code}).encode("utf-8")
    req = urllib.request.Request(
        sandbox_url.rstrip("/") + "/execute",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
            return jsonify(result), response.status
    except urllib.error.HTTPError as e:
        try:
            error_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            error_body = {"success": False, "error": "Sandbox execution failed."}
        return jsonify(error_body), e.code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Sandbox executor unavailable: {e}"
        }), 503


@notebooks_bp.route("/api/save_notebook", methods=["POST"])
def save_notebook_db():
    user, error = require_login()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    name = data.get("name")
    content = data.get("content")

    if not content:
        return jsonify({"success": False, "error": "Notebook content required"}), 400

    notebook = Notebook.query.filter_by(user_id=user.id, name=name).first()
    if notebook:
        notebook.content = content
    else:
        notebook = Notebook(user_id=user.id, name=name, content=content)
        db.session.add(notebook)

    db.session.commit()
    return jsonify({"success": True, "message": "Notebook saved to cloud"}), 200


@notebooks_bp.route("/api/list_notebooks", methods=["GET"])
def list_notebooks():
    user, error = require_login()
    if error:
        return error

    notebooks = Notebook.query.filter_by(user_id=user.id).all()
    return jsonify({
        "success": True,
        "notebooks": [
            {"id": n.id, "name": n.name, "last_modified": n.last_modified.isoformat()}
            for n in notebooks
        ]
    }), 200


@notebooks_bp.route("/api/load_notebook", methods=["GET"])
def load_notebook():
    user, error = require_login()
    if error:
        return error

    notebook_id = request.args.get("id")
    if not notebook_id:
        return jsonify({"success": False, "error": "Notebook ID required"}), 400

    notebook = db.session.get(Notebook, notebook_id)
    if not notebook or notebook.user_id != user.id:
        return jsonify({"success": False, "error": "Notebook not found"}), 404

    return jsonify({
        "success": True,
        "name": notebook.name,
        "content": notebook.content
    }), 200
