# DeepDTA Project Structure

This project is organized so each folder has one clear responsibility.

## Main Application

- `backend/`
  - `app.py` - Flask app factory. Configures CORS, CSRF, database initialization, notebook runtime, and route registration.
  - `config.py` - Environment variables, paths, limits, CORS origins, database URL, and app config.
  - `extensions.py` - Shared Flask extensions such as SQLAlchemy.
  - `models.py` - Database models such as users and notebooks.
  - `security.py` - CSRF protection, login checks, current-user helpers, and rate limiting.
  - `services/`
    - `model_client.py` - Backend client for calling the private DeepDTAGen model service.
    - `notebook_runtime.py` - Runtime namespace and uploaded dataset lookup helpers for notebook features.
  - `routes/`
    - `auth.py` - Register, login, logout, current user, and CSRF token routes.
    - `datasets.py` - Dataset upload and public dataset download routes.
    - `health.py` - Backend health route.
    - `model_proxy.py` - Prediction, generation, and model unload proxy routes.
    - `notebooks.py` - Notebook upload, execution handoff, save, list, and load routes.
    - `static.py` - Frontend static file serving routes.
    - `visualization.py` - SMILES/molecule/protein visualization routes.

- `deepdta-dashboard-main/`
  - Lovable React/Vite frontend now used for the main website.
  - `src/lib/api.ts` - Shared API client connected to the Flask backend.
  - Run locally with `npm run dev` and open `http://127.0.0.1:5500`.

- `services/`
  - `model_service.py` - Heavy DeepDTAGen model service. Loads PyTorch/model weights only for prediction/generation.
  - `sandbox_executor.py` - Isolated notebook/code execution service.

## AI And Data Assets

- `models/`
  - Pretrained DeepDTAGen `.pth` model weights.

- `DeepDTAGen-master/`
  - Original DeepDTAGen research/model code and tokenizer files.

- `data/`
  - Model/tokenizer support data and processed data.
  - `data/raw/` - Large raw dataset files used for downloads or preprocessing.

## Runtime Files

- `runtime/`
  - Local generated files that should not be treated as source code.
  - `deepdta_local.db` - Local SQLite database.
  - `workspace_uploads/` - Uploaded datasets.
  - `logs/` - Local logs.
  - `saved_models/`, `Affinities/` - Training/runtime outputs.

## Scripts And Reports

- `scripts/`
  - Training, preprocessing, dependency checks, and experiment utilities.

- `reports/`
  - Error logs and dependency reports generated during development.

## Local Launchers

- `start_backend_light.bat`
  - Starts the lightweight Flask backend locally.

- `start_model_service.bat`
  - Starts the heavy DeepDTAGen model service locally only when prediction/generation is needed.

## Configuration

- `.env`
  - Local secrets and environment settings. Do not commit this file.

- `.env.example`
  - Safe template showing which environment variables are needed.
