@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Worker entrypoint for bank-statement AI matching via local Codex CLI.
rem Usage:
rem   run_bank_statement_match.bat ^<4digits^|all^> ^<YYYY-MM^>
rem Examples:
rem   run_bank_statement_match.bat 7236 2026-06
rem   run_bank_statement_match.bat all 2026-06
rem
rem Designed for unattended Python worker calls:
rem   subprocess.run([r"...\\worker_tasks\\run_bank_statement_match.bat", "7236", "2026-06"], check=True)

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
pushd "%REPO_ROOT%" || (
  echo ERROR: Could not cd to repo root: %REPO_ROOT%
  exit /b 1
)

set "ACCOUNT=%~1"
set "MONTH=%~2"

if "%ACCOUNT%"=="" goto :usage
if "%MONTH%"=="" goto :usage

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run_bank_statement_match.ps1" -Account "%ACCOUNT%" -Month "%MONTH%"
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%

:usage
echo Usage: %~nx0 ^<4digits^|all^> ^<YYYY-MM^>
echo.
echo Accounts: 0393 1139 3557 4759 6184 7236  ^(or all^)
echo Example:  %~nx0 7236 2026-06
popd 2>nul
exit /b 2
