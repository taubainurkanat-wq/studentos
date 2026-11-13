@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -m venv .venv
  if errorlevel 1 (
    echo Python was not found. Install Python 3.11+ first.
    pause
    exit /b 1
  )
)
call ".venv\Scripts\activate.bat"
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Installation failed. Check your internet connection.
  pause
  exit /b 1
)
echo StudentOS is starting at http://127.0.0.1:8000
python -m uvicorn app:app --reload
pause
