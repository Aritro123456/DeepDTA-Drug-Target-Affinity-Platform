import os
import uuid

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from ..config import ALLOWED_DATASET_EXTENSIONS, PUBLIC_DATASET_DOWNLOADS, RAW_DATA_DIR, UPLOAD_DIR
from ..security import rate_limit, require_login
from ..services.notebook_runtime import NOTEBOOK_NAMESPACE


datasets_bp = Blueprint("datasets", __name__)


@datasets_bp.route("/api/upload_dataset", methods=["POST"])
def upload_dataset():
    user, error = require_login()
    if error:
        return error

    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided in request"}), 400

    file = request.files["file"]
    filename = file.filename or ""
    if not filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    safe_name = secure_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_DATASET_EXTENSIONS:
        allowed_types = ", ".join(sorted(ALLOWED_DATASET_EXTENSIONS))
        return jsonify({
            "success": False,
            "error": f"Unsupported dataset type. Allowed types: {allowed_types}"
        }), 400

    final_path = os.path.join(UPLOAD_DIR, safe_name)
    stem, suffix = os.path.splitext(safe_name)
    counter = 1
    while os.path.exists(final_path):
        final_path = os.path.join(UPLOAD_DIR, f"{stem}_{counter}{suffix}")
        counter += 1

    file.save(final_path)
    file_size = os.path.getsize(final_path)

    dataset_id = uuid.uuid4().hex
    dataset_record = {
        "id": dataset_id,
        "name": os.path.basename(final_path),
        "original_name": filename,
        "path": final_path,
        "size_bytes": file_size
    }

    existing = [
        item for item in NOTEBOOK_NAMESPACE.get("uploaded_datasets", [])
        if item.get("id") != dataset_id
    ]
    existing.append(dataset_record)
    NOTEBOOK_NAMESPACE["uploaded_datasets"] = existing
    NOTEBOOK_NAMESPACE["latest_dataset_path"] = final_path
    NOTEBOOK_NAMESPACE["latest_dataset_id"] = dataset_id
    NOTEBOOK_NAMESPACE["latest_dataset_name"] = os.path.basename(final_path)

    public_dataset_record = {
        "id": dataset_id,
        "name": os.path.basename(final_path),
        "original_name": filename,
        "size_bytes": file_size
    }

    return jsonify({
        "success": True,
        "dataset": public_dataset_record,
        "message": "Dataset uploaded successfully"
    }), 200


@datasets_bp.route("/data/raw/<path:filename>")
@rate_limit("dataset_download", 20, 3600)
def serve_raw_dataset(filename):
    if filename not in PUBLIC_DATASET_DOWNLOADS:
        return jsonify({"success": False, "error": "Dataset download is not available"}), 404

    return send_from_directory(RAW_DATA_DIR, filename, as_attachment=True)
