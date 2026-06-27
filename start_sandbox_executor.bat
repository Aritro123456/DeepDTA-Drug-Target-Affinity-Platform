@echo off
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" services\sandbox_executor.py
) else (
    python services\sandbox_executor.py
)
