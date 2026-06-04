Option Explicit

Dim fso, shell, scriptDir, root, nodePath, logDir, logPath, command, exitCode

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(scriptDir)
nodePath = "C:\Program Files\nodejs\node.exe"

If Not fso.FileExists(nodePath) Then
  nodePath = "node.exe"
End If

shell.CurrentDirectory = root
logDir = fso.BuildPath(root, ".kai")
If Not fso.FolderExists(logDir) Then
  fso.CreateFolder(logDir)
End If
logPath = fso.BuildPath(logDir, "autonomy-hidden.log")
command = "%ComSpec% /c " & """" & """" & nodePath & """ src\cli.mjs autonomy run --json >> """ & logPath & """ 2>&1" & """"
exitCode = shell.Run(command, 0, True)

WScript.Quit exitCode
