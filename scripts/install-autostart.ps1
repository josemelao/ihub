param(
	[string]$StartupDir = [Environment]::GetFolderPath('Startup')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot 'start-hidden.vbs'
$shortcutPath = Join-Path $StartupDir 'Meu Hub.lnk'

if (-not (Test-Path $vbs)) {
	throw "Launcher não encontrado: $vbs"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
	throw 'Node.js não encontrado no PATH. Instale o Node 24+ antes do autostart.'
}

$build = Join-Path $root 'build\index.js'
if (-not (Test-Path $build)) {
	Write-Warning "Build não encontrado em $build. Rode 'npm run build' antes de usar o autostart."
}

$busy = $false
try {
	$client = New-Object System.Net.Sockets.TcpClient
	$client.Connect('127.0.0.1', 5757)
	$busy = $client.Connected
	$client.Close()
} catch {
	$busy = $false
}
if ($busy) {
	Write-Warning 'A porta 5757 já está em uso. O hub pode já estar rodando; o atalho será criado mesmo assim.'
}

New-Item -ItemType Directory -Force -Path $StartupDir | Out-Null

$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscript
$shortcut.Arguments = "//B `"$vbs`""
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 7
$shortcut.Description = 'Inicia o Meu Hub em 127.0.0.1:5757'
if ($node.Source) {
	$shortcut.IconLocation = "$($node.Source),0"
}
$shortcut.Save()

Write-Output "Atalho criado: $shortcutPath"
Write-Output 'Para desfazer: powershell -ExecutionPolicy Bypass -File scripts\uninstall-autostart.ps1'
