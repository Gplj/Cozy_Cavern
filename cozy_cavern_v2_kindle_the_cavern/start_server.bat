@echo off
start "Cozy Cavern local server" cmd /k py -m http.server 8000
ping 127.0.0.1 -n 2 >nul
start http://localhost:8000
