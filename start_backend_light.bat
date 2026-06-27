@echo off
setlocal
cd /d "%~dp0"

if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

if not defined FLASK_SECRET_KEY (
    echo FLASK_SECRET_KEY is missing. Add it to .env before starting the backend.
    exit /b 1
)
if not defined MODEL_SERVICE_TOKEN (
    echo MODEL_SERVICE_TOKEN is missing. Add it to .env before starting the backend.
    exit /b 1
)

if not defined FLASK_HOST set FLASK_HOST=127.0.0.1
if not defined FLASK_PORT set FLASK_PORT=5000
if not defined DATABASE_URL set DATABASE_URL=sqlite:///%CD%\runtime\deepdta_local.db
if not defined CORS_ALLOWED_ORIGINS set CORS_ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000,http://localhost:5500,http://127.0.0.1:5500
if not defined MODEL_SERVICE_URL set MODEL_SERVICE_URL=http://127.0.0.1:5051
if not defined MODEL_SERVICE_AUTO_START set MODEL_SERVICE_AUTO_START=true
if not defined MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS set MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS=45
if not defined NOTEBOOK_EXECUTION_ENABLED set NOTEBOOK_EXECUTION_ENABLED=true
if not defined SANDBOX_EXECUTOR_URL set SANDBOX_EXECUTOR_URL=http://127.0.0.1:5050

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m backend.app
) else (
    python -m backend.app
)
