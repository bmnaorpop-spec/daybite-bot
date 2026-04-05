Dim shell
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\BARAK NEW\Desktop\daybite-bot"
shell.Run "cmd.exe /c ""C:\Program Files\Git\bin\bash.exe"" -c ""cd /c/Users/BARAK\ NEW/Desktop/daybite-bot && nohup /c/Program\ Files/nodejs/node.exe --experimental-sqlite run.js >> logs/bot.log 2>&1 &""", 0, False
