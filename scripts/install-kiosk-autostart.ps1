param([switch]$Remove)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$startupDirectory = [Environment]::GetFolderPath("Startup")
$launcherPath = Join-Path $startupDirectory "PixieBooth Kiosk.vbs"

if ($Remove) {
  if (Test-Path -LiteralPath $launcherPath) {
    Remove-Item -LiteralPath $launcherPath -Force
  }
  Write-Host "PixieBooth dihapus dari Windows Startup."
  exit 0
}

$escapedRoot = $projectRoot.Replace('"', '""')
$script = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd.exe /c cd /d ""$escapedRoot"" && npm.cmd run kiosk", 0, False
"@

Set-Content -LiteralPath $launcherPath -Value $script -Encoding ASCII
Write-Host "PixieBooth akan otomatis berjalan setelah login Windows."
Write-Host "Launcher: $launcherPath"
