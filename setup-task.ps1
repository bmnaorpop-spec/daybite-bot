$action = New-ScheduledTaskAction -Execute "C:\Users\BARAK NEW\Desktop\daybite-bot\start-bot.bat"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName "DayBiteBot" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force
Write-Host "Task created successfully"
