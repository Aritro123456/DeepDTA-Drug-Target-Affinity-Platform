from flask import Blueprint, jsonify, request

from ..security import rate_limit, require_login
from ..services.model_client import call_model_service


model_proxy_bp = Blueprint("model_proxy", __name__)


@model_proxy_bp.route("/predict", methods=["GET"])
@rate_limit("model", 20, 600)
def predict():
    user, error = require_login()
    if error:
        return error

    smiles = request.args.get("smiles")
    sequence = request.args.get("sequence")
    if not smiles or not sequence:
        return jsonify({"success": False, "error": "Missing input"}), 400

    return call_model_service("/predict", {
        "smiles": smiles,
        "sequence": sequence
    })


@model_proxy_bp.route("/generate", methods=["GET"])
@rate_limit("model", 10, 600)
def generate():
    user, error = require_login()
    if error:
        return error

    sequence = request.args.get("sequence")
    target_affinity = request.args.get("affinity", 6.0)
    seed_smiles = request.args.get(
        "smiles",
        "O=C(c1nc(NS(=O)(=O)c2cc(Br)cc(Cl)c2O)cn1C1CCCC1)N1CCC(C2CCCN2)CC1"
    )

    if not sequence:
        return jsonify({"success": False, "error": "Missing protein sequence"}), 400

    return call_model_service("/generate", {
        "sequence": sequence,
        "affinity": target_affinity,
        "smiles": seed_smiles
    })


@model_proxy_bp.route("/api/unload_model", methods=["POST"])
def unload_model():
    user, error = require_login()
    if error:
        return error

    return call_model_service("/unload", method="POST", payload={})
