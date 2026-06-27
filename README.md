# DeepDTA Drug-Target Affinity Platform

A full-stack drug discovery research platform for predicting drug-target binding affinity, exploring molecules and proteins, managing datasets, and running notebook-style experiments from one web interface.

This project was built to make DeepDTA-style drug-target affinity work easier to understand and use. Instead of keeping model scripts, datasets, predictions, and visualizations scattered across notebooks and terminal commands, the platform brings them into a structured web application with a modern frontend, a Flask backend, and a separated AI model service.

## Why This Project Exists

Drug discovery often needs quick answers to questions like:

- How strongly might a small molecule bind to a protein target?
- Can a researcher compare ligand/protein inputs without manually running scripts?
- Can datasets, molecule views, protein views, and prediction history live in one place?
- Can heavy AI model loading be separated from the normal website so the app stays responsive?

This project explores those questions through a local-first DeepDTA platform. It is designed as a learning and portfolio project, but the architecture has been improved toward production-style separation of concerns, security hardening, and maintainability.

## Core Features

- Drug-target affinity prediction workflow
- Molecule/SMILES validation and visualization
- Protein sequence visualization support
- Dataset upload and dataset download flow
- User login, sessions, CSRF protection, and notebook ownership checks
- Notebook-style code execution through a separate sandbox executor service
- Lazy model-service startup for heavy prediction/generation features
- React/Vite dashboard frontend connected to a Flask API backend
- Security-focused project cleanup with local secrets, models, virtual environments, and runtime files excluded from Git

## Architecture

```text
deepdta-dashboard-main/       React + Vite frontend
backend/                      Flask API, auth, sessions, datasets, notebooks, proxy routes
services/model_service.py     Heavy DeepDTAGen model service
services/sandbox_executor.py  Notebook/code execution service
DeepDTAGen-master/            Original DeepDTAGen model/research code
data/                         Public small data files and dataset helpers
models/                       Local model weights, ignored from Git
runtime/                      Local database/uploads/logs, ignored from Git
```

The main Flask backend stays lightweight. Heavy AI model loading is handled by the model service, which can start only when prediction or generation is needed. This keeps the normal website smoother on a local machine.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn-style UI components
- Backend: Python, Flask, SQLAlchemy
- ML/AI: DeepDTA / DeepDTAGen model code, PyTorch-based model service
- Visualization: Three.js / React Three Fiber support
- Storage: local SQLite for development
- Security: sessions, CSRF checks, restricted CORS, service-token auth, ignored local secrets

## Local Setup

Clone the repository:

```bat
git clone https://github.com/Aritro123456/DeepDTA-Drug-Target-Affinity-Platform.git
cd DeepDTA-Drug-Target-Affinity-Platform
```

Create your local environment file:

```bat
copy .env.example .env
```

Then edit `.env` and replace the placeholder values:

```text
FLASK_SECRET_KEY=replace_with_a_long_random_secret
MODEL_SERVICE_TOKEN=replace_with_a_long_random_model_service_token
```

Install frontend dependencies:

```bat
cd deepdta-dashboard-main
npm install
cd ..
```

Set up a Python virtual environment and install the backend/model dependencies required by your local setup. The original DeepDTAGen environment file is available at:

```text
DeepDTAGen-master/environment.yml
```

## Running Locally

Start the Flask backend:

```bat
start_backend_light.bat
```

Start the React frontend:

```bat
cd deepdta-dashboard-main
npm run dev -- --host 127.0.0.1 --port 5500
```

Open:

```text
http://127.0.0.1:5500
```

Optional notebook execution service:

```bat
start_sandbox_executor.bat
```

Optional model service:

```bat
start_model_service.bat
```

The backend is configured to support lazy model-service startup for prediction/generation workflows.

## Security Notes

This repository intentionally does not commit local secrets or heavy runtime artifacts.

Ignored from Git:

- `.env`
- `.venv/`
- `runtime/`
- `models/`
- `node_modules/`
- frontend build output
- local databases
- model weights such as `.pth`, `.pt`, `.pkl`
- generated logs and uploads

Security improvements already added:

- Real secrets moved out of source code
- CORS restricted to configured origins
- Session-based authentication
- CSRF protection for state-changing routes
- Notebook ownership checks
- Model service protected with a service token
- Notebook execution moved out to a separate executor service
- Raw server filesystem paths are not exposed directly to the frontend

## Current Limitations

- This is currently optimized for local development and demonstration.
- Large model weights are not included in GitHub and must be provided locally.
- One raw dataset file is large and may be better moved to Git LFS, GitHub Releases, or an external dataset host.
- Public deployment would need production hosting, HTTPS, managed secrets, a production database, stronger rate limiting, observability, and a safer hosted execution environment.

## Repository Structure

For a more detailed file-by-file explanation, see:

```text
PROJECT_STRUCTURE.md
```

## Future Improvements

- Move large datasets/model weights to external storage or Git LFS
- Add production deployment configuration
- Add automated backend and frontend CI checks
- Add richer model evaluation reports
- Add hosted demo mode with sample predictions
- Add monitoring, request logging, and production rate-limit storage

## Project Goal

The goal of this project is to demonstrate how machine learning research code can be transformed into a more usable full-stack application. It combines AI model inference, scientific data handling, visualization, authentication, security hardening, and frontend/backend integration in one practical platform.
