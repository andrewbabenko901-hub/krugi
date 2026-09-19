@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Круги — локальный просмотр
start "" http://localhost:8799/?probe=%RANDOM%
py -3 -m http.server 8799
