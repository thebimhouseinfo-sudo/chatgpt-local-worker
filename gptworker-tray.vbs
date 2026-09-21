' GPTWorker silent tray launcher for Windows
' Uses wscript (GUI subsystem) to launch PowerShell with SW_HIDE (0),
' preventing Windows Terminal / console window from appearing on Windows 10/11.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
trayScript = scriptDir & "\gptworker-tray.ps1"

args = ""
If WScript.Arguments.Count > 0 Then
    For i = 0 To WScript.Arguments.Count - 1
        args = args & " " & WScript.Arguments(i)
    Next
End If

cmd = "powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & trayScript & """" & args
WshShell.Run cmd, 0, False
