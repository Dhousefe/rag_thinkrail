# cleanup_and_prepare_payload.ps1
$ErrorActionPreference = 'Stop'
$ts = (Get-Date -Format yyyyMMdd_HHmmss)
$backupRoot = 'D:\Projet_Thinkrail\source\thinkrail\backups'
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot | Out-Null }
$backup = Join-Path $backupRoot ('backup_' + $ts)
New-Item -ItemType Directory -Path $backup | Out-Null
Write-Output "Backup dir: $backup"

$files = @(
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\models\jina-code-onnx\model.onnx.data',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\thinkrail-v16.0.2.exe',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\thinkrail-v17.0.0.exe',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\thinkrail-v17.exe',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\thinkrail-v18.0.0.exe'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    Write-Output "Moving: $f"
    Move-Item -Path $f -Destination $backup -Force
  } else {
    Write-Output "Not found, skipping: $f"
  }
}

# remove staging and payload dirs if present
$pathsToRemove = @(
  'D:\Projet_Thinkrail\source\thinkrail\staging',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\gui-installer\packager\nsis\payload',
  'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\gui-installer\packager\payload'
)
foreach ($p in $pathsToRemove) {
  if (Test-Path $p) {
    Write-Output "Removing: $p"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $p
  }
}

# remove large gifs in instalador
$instaladorDir = 'D:\Projet_Thinkrail\source\thinkrail\apps\cli\dist\instalador'
if (Test-Path $instaladorDir) {
  Get-ChildItem $instaladorDir -Filter 'rec_*.gif' -File -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output "Removing gif: $($_.FullName)"
    Remove-Item $_.FullName -Force
  }
}

# report free space
$drive = Get-PSDrive -Name D
$freeGB = [math]::Round($drive.Free / 1GB, 2)
Write-Output "Free space (GB): $freeGB"
Write-Output "Cleanup complete"
