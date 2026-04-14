@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv" (
  where py >nul 2>&1 && (
    echo Creating .venv with py -3 -m venv ...
    py -3 -m venv .venv
  ) || (
    echo Creating .venv with python -m venv ...
    python -m venv .venv
  )
)

call ".venv\Scripts\activate.bat"
pip install -r requirements.txt
echo Starting server at http://localhost:8000 ...
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
