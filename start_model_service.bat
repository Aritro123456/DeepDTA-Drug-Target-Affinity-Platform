@echo off
setlocal
cd /d "%~dp0"

if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

if not defined MODEL_SERVICE_TOKEN (
    echo MODEL_SERVICE_TOKEN is missing. Add it to .env before starting the model service.
    exit /b 1
)

if not defined MODEL_SERVICE_HOST set MODEL_SERVICE_HOST=127.0.0.1
if not defined MODEL_SERVICE_PORT set MODEL_SERVICE_PORT=5051
if not defined DEEPDTA_MODEL_DATASET set DEEPDTA_MODEL_DATASET=bindingdb
if not defined MODEL_IDLE_UNLOAD_SECONDS set MODEL_IDLE_UNLOAD_SECONDS=300
if not defined MODEL_SERVICE_EXIT_AFTER_IDLE set MODEL_SERVICE_EXIT_AFTER_IDLE=true

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" services\model_service.py
) else (
    python services\model_service.py
)
