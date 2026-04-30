@echo off
title Flow
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ========================================
echo   Flow - AI Knowledge Tree
echo ========================================
echo.

call :show_progress 0 "Initializing..."

REM ─── Step 1: Backend venv + deps ───
call :show_progress 5 "Setting up Python venv..."
cd /d "%~dp0backend"

if not exist "venv" (
    echo.
    echo   Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

call :show_progress 15 "Installing Python packages..."
echo.
pip install -r requirements.txt

python -m uvicorn --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    pip install uvicorn fastapi pydantic python-multipart
)

REM ─── Step 2: Start backend ───
echo.
call :show_progress 40 "Starting backend server..."
start "Flow-Backend" "%~dp0backend\run_backend.bat"
echo.
echo   Backend started at http://localhost:8000

REM ─── Step 3: Frontend deps ───
call :show_progress 60 "Installing frontend packages..."
echo.
cd /d "%~dp0frontend"
call npm install

REM ─── Step 4: Start frontend ───
echo.
call :show_progress 85 "Starting frontend dev server..."
start "Flow-Frontend" "%~dp0frontend\run_frontend.bat"
echo.
echo   Frontend started at http://localhost:5173

call :show_progress 100 "Done!"
echo.
echo ========================================
echo   Startup complete!
echo   Frontend: http://localhost:5173
echo   Backend: http://localhost:8000
echo   API docs: http://localhost:8000/docs
echo ========================================
echo.
echo Close the windows to stop services.
pause
goto :eof

REM ─── Progress bar ───
:show_progress
set "pct=%~1"
set "label=%~2"
set /a "full=(pct * 20) / 100"
set "bar="
for /l %%i in (1,1,!full!) do set "bar=!bar!#"
set /a "empty=20 - full"
for /l %%i in (1,1,!empty!) do set "bar=!bar!-"
echo [!bar!] !pct!%%  !label!
exit /b 0
