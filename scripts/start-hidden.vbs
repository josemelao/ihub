Option Explicit

Dim fso, shell, root, node, command, candidates, i, dataDir, logFile

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

candidates = Array( _
	shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
	shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"), _
	shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe") _
)

node = ""
For i = 0 To UBound(candidates)
	If fso.FileExists(candidates(i)) Then
		node = candidates(i)
		Exit For
	End If
Next

If node = "" Then
	If shell.Run("cmd /c node --version >nul 2>&1", 0, True) = 0 Then
		node = "node.exe"
	End If
End If

If node = "" Then
	dataDir = root & "\data"
	If Not fso.FolderExists(dataDir) Then fso.CreateFolder(dataDir)
	Set logFile = fso.OpenTextFile(dataDir & "\autostart.log", 8, True)
	logFile.WriteLine Now & " - Node.js nao encontrado no PATH nem em Program Files; o hub nao foi iniciado."
	logFile.Close
	WScript.Quit 1
End If

shell.CurrentDirectory = root
command = """" & node & """ """ & root & "\scripts\start.mjs"""
shell.Run command, 0, False
