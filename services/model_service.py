import gc
import hashlib
import json
import os
import pickle
import random
import secrets
import sys
import threading
from functools import wraps

import numpy as np
import torch
from flask import Flask, jsonify, request
from rdkit import Chem

if not hasattr(np, 'float'):
    np.float = float
if not hasattr(np, 'int'):
    np.int = int
if not hasattr(np, 'bool'):
    np.bool = bool

service_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(service_dir)
model_master_path = os.path.join(project_root, 'DeepDTAGen-master')
demo_utils_path = os.path.join(model_master_path, 'DEMO', 'required_files_for_demo')
sys.path.append(model_master_path)
sys.path.append(demo_utils_path)

try:
    from model_aff import DeepDTAGen
    from demo_utils import process_latent_a, process_latent, collate
    HAS_MODEL = True
except ImportError as e:
    print(f"Warning: Could not load DeepDTAGen dependencies: {e}")
    HAS_MODEL = False

app = Flask(__name__)
MODEL_SERVICE_TOKEN = os.environ.get('MODEL_SERVICE_TOKEN', '')
MODEL_SERVICE_TOKEN_HEADER = 'X-Model-Service-Token'

if not MODEL_SERVICE_TOKEN or len(MODEL_SERVICE_TOKEN) < 32:
    raise RuntimeError(
        "MODEL_SERVICE_TOKEN must be set to a long random value before starting the model service."
    )


def require_service_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        provided_token = request.headers.get(MODEL_SERVICE_TOKEN_HEADER, '')
        if not secrets.compare_digest(provided_token, MODEL_SERVICE_TOKEN):
            return jsonify({"success": False, "error": "Unauthorized model service request"}), 401
        return fn(*args, **kwargs)
    return wrapper

model = None
tokenizer = None
device = torch.device('cpu')
model_lock = threading.RLock()
model_unload_timer = None


def unload_deepdtagen_model():
    global model, tokenizer, model_unload_timer
    with model_lock:
        model = None
        tokenizer = None
        model_unload_timer = None
        gc.collect()
        print("DeepDTAGen model unloaded.")
        if os.environ.get('MODEL_SERVICE_EXIT_AFTER_IDLE', 'false').lower() == 'true':
            print("Model service exiting after idle unload.")
            os._exit(0)


def schedule_model_unload():
    global model_unload_timer
    idle_seconds = int(os.environ.get('MODEL_IDLE_UNLOAD_SECONDS', '300'))
    if idle_seconds <= 0:
        return

    with model_lock:
        if model_unload_timer:
            model_unload_timer.cancel()
        model_unload_timer = threading.Timer(idle_seconds, unload_deepdtagen_model)
        model_unload_timer.daemon = True
        model_unload_timer.start()


def load_deepdtagen_model():
    global model, tokenizer
    if model is not None:
        schedule_model_unload()
        return True

    if not HAS_MODEL:
        return False

    with model_lock:
        if model is not None:
            schedule_model_unload()
            return True

        try:
            dataset_name = os.environ.get('DEEPDTA_MODEL_DATASET', 'bindingdb')
            consolidated_path = os.path.join(project_root, 'models', f'deepdtagen_full_{dataset_name}.pkl')

            if os.path.exists(consolidated_path):
                print(f"Loading consolidated model from {consolidated_path}")
                with open(consolidated_path, 'rb') as f:
                    combined_data = pickle.load(f)

                tokenizer = combined_data['tokenizer']
                model = DeepDTAGen(tokenizer)
                model.load_state_dict(combined_data['state_dict'], strict=False)
            else:
                model_path = os.path.join(project_root, 'models', f'deepdtagen_model_{dataset_name}.pth')
                tokenizer_path = os.path.join(model_master_path, 'data', f'{dataset_name}_tokenizer.pkl')

                if not os.path.exists(model_path) or not os.path.exists(tokenizer_path):
                    print(f"Model or tokenizer not found at {model_path} or {tokenizer_path}")
                    return False

                with open(tokenizer_path, 'rb') as f:
                    tokenizer = pickle.load(f)

                model = DeepDTAGen(tokenizer)
                model.load_state_dict(torch.load(model_path, map_location=device, weights_only=False), strict=False)

            model.eval()
            schedule_model_unload()
            print("DeepDTAGen model loaded.")
            return True
        except Exception as e:
            print(f"Error loading DeepDTAGen model: {e}")
            model = None
            tokenizer = None
            return False


def simulated_prediction(smiles, sequence):
    seed = int(hashlib.md5((smiles + sequence).encode()).hexdigest(), 16) % 10000
    random.seed(seed)
    return {
        "success": True,
        "score": random.uniform(4.0, 9.0),
        "confidence": random.uniform(0.85, 0.98),
        "complexity": "High" if len(sequence) > 200 else "Medium",
        "real_model": False
    }


def simulated_generation(sequence, target_affinity):
    seed = int(hashlib.md5((sequence + str(target_affinity)).encode()).hexdigest(), 16) % 10000
    random.seed(seed)
    mocks = [
        "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
        "CC(=O)Oc1ccccc1C(=O)O",
        "CN(C)CC(C1=CC=CC=C1)OC2=C(C=CC=C2)C",
        "CNC(C)CC1=CC2=C(C=C1)OCO2",
        "CC1=C(C(C(=C(N1)C)C(=O)OC)C2=CC=CC=C2[N+](=O)[O-])C(=O)OC"
    ]
    return {
        "success": True,
        "smiles": random.choice(mocks),
        "predicted_affinity": target_affinity + random.uniform(-0.5, 0.5),
        "is_valid": True,
        "real_model": False
    }


@app.route('/predict', methods=['GET'])
@require_service_token
def predict():
    smiles = request.args.get('smiles')
    sequence = request.args.get('sequence')

    if not smiles or not sequence:
        return jsonify({"success": False, "error": "Missing input"}), 400

    if load_deepdtagen_model() and model is not None:
        try:
            os.makedirs('data', exist_ok=True)
            test_data = process_latent_a(smiles, sequence)
            test_loader = torch.utils.data.DataLoader(
                test_data,
                batch_size=1,
                shuffle=False,
                collate_fn=collate
            )

            with torch.no_grad():
                for data_batch in test_loader:
                    prediction = model(data_batch.to(device))
                    if isinstance(prediction, (list, tuple)):
                        prediction = prediction[0]
                    score = float(prediction.cpu().detach().item())

            return jsonify({
                "success": True,
                "score": score,
                "confidence": 0.92,
                "complexity": "High" if len(sequence) > 200 else "Medium",
                "real_model": True
            })
        except Exception as e:
            print(f"Model inference failed, falling back to simulation: {e}")

    return jsonify(simulated_prediction(smiles, sequence)), 200


@app.route('/generate', methods=['GET'])
@require_service_token
def generate():
    sequence = request.args.get('sequence')
    target_affinity = request.args.get('affinity', 6.0)
    seed_smiles = request.args.get(
        'smiles',
        "O=C(c1nc(NS(=O)(=O)c2cc(Br)cc(Cl)c2O)cn1C1CCCC1)N1CCC(C2CCCN2)CC1"
    )

    if not sequence:
        return jsonify({"success": False, "error": "Missing protein sequence"}), 400

    try:
        target_affinity = float(target_affinity)
    except Exception:
        target_affinity = 6.0

    if load_deepdtagen_model() and model is not None:
        try:
            os.makedirs('data', exist_ok=True)
            test_data = process_latent(seed_smiles, sequence, target_affinity)
            test_loader = torch.utils.data.DataLoader(
                test_data,
                batch_size=1,
                shuffle=False,
                collate_fn=collate
            )

            with torch.no_grad():
                generated_smiles = None
                predicted_score = None
                for data_batch in test_loader:
                    generated_indices = model.generate(data_batch.to(device))
                    generated_smiles = tokenizer.get_text(generated_indices)[0]
                    prediction = model(data_batch.to(device))
                    predicted_score = float(prediction.cpu().detach().item())

            if not generated_smiles or predicted_score is None:
                raise RuntimeError("Model generation produced no output")

            return jsonify({
                "success": True,
                "smiles": generated_smiles,
                "predicted_affinity": predicted_score,
                "is_valid": Chem.MolFromSmiles(generated_smiles) is not None,
                "real_model": True
            })
        except Exception as e:
            print(f"Model generation failed, falling back to simulation: {e}")

    return jsonify(simulated_generation(sequence, target_affinity)), 200


@app.route('/unload', methods=['POST'])
@require_service_token
def unload_model():
    unload_deepdtagen_model()
    return jsonify({"success": True, "model_loaded": False}), 200


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "has_model_dependencies": HAS_MODEL,
        "model_loaded": model is not None
    }), 200


if __name__ == '__main__':
    host = os.environ.get('MODEL_SERVICE_HOST', '127.0.0.1')
    port = int(os.environ.get('MODEL_SERVICE_PORT', '5051'))
    debug = os.environ.get('MODEL_SERVICE_DEBUG', 'false').lower() == 'true'
    print(f"Starting DeepDTA model service on http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)
