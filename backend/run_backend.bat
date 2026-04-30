@echo off
title Flow-Backend
cd /d "%~dp0"

echo Activating venv...
call venv\Scripts\activate.bat

echo Starting backend server...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

echo.
echo Backend stopped.
pause
