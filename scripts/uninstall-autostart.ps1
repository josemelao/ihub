param(
	[string]$StartupDir = [Environment]::GetFolderPath('Startup')
)

$ErrorActionPreference = 'Stop'
$shortcutPath = Join-Path $StartupDir 'Meu Hub.lnk'

if (Test-Path $shortcutPath) {
	Remove-Item $shortcutPath -Force
	Write-Output "Atalho removido: $shortcutPath"
} else {
	Write-Output "Nenhum atalho encontrado em $shortcutPath"
}
