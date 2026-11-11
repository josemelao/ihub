Option Explicit

Dim fso, shell, root, node, command

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
node = shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe")
If Not fso.FileExists(node) Then
	node = "node.exe"
End If

shell.CurrentDirectory = root
command = """" & node & """ """ & root & "\scripts\start.mjs"""
shell.Run command, 0, False
