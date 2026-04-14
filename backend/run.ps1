# Starts the API on http://localhost:8000 using the project venv.
# Run from PowerShell: cd backend; .\run.ps1
# If execution is blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        Write-Host "Creating .venv with py -3 -m venv ..."
        py -3 -m venv .venv
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host "Creating .venv with python -m venv ..."
        python -m venv .venv
    }
    else {
        Write-Error @"
Python was not found on PATH.

Install Python 3.11+ from https://www.python.org/downloads/
On the installer, check **Add python.exe to PATH**, then open a new terminal and run this script again.
"@
        exit 1
    }
}

& .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Write-Host "Starting server at http://localhost:8000 ..."
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
