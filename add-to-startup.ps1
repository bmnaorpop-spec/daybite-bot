$startupFolder = [System.Environment]::GetFolderPath("Startup")
$vbsPath = "C:\Users\BARAK NEW\Desktop\daybite-bot\run-hidden.vbs"
$shortcutPath = "$startupFolder\DayBiteBot.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = """$vbsPath"""
$shortcut.WorkingDirectory = "C:\Users\BARAK NEW\Desktop\daybite-bot"
$shortcut.Description = "DayBite Telegram Bot"
$shortcut.Save()

Write-Output "Shortcut created at: $shortcutPath"
