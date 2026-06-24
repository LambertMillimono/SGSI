@echo off
echo ================================================
echo   SGSI Mobile - Installation des dependances
echo ================================================
echo.
cd /d "%~dp0"
echo Installation en cours (patience ~5-10 min)...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERREUR. Verifiez votre connexion Internet.
    pause
    exit /b 1
)
echo.
echo Installation terminee !
echo Pour lancer: npm start
echo Puis scannez le QR code avec Expo Go sur votre telephone.
pause
