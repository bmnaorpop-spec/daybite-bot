$botDir = "C:\Users\BARAK NEW\Desktop\daybite-bot"
$node = "C:\Program Files\nodejs\node.exe"
$logFile = "$botDir\logs\bot.log"

if (-not (Test-Path "$botDir\logs")) {
    New-Item -ItemType Directory -Path "$botDir\logs" | Out-Null
}

$proc = Start-Process -FilePath $node `
    -ArgumentList "--experimental-sqlite", "run.js" `
    -WorkingDirectory $botDir `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError $logFile `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Bot started with PID $($proc.Id)"
$proc.Id | Out-File "$botDir\bot.pid"
