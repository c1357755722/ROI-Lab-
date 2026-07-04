$ErrorActionPreference = "Stop"

$toolsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $toolsRoot
$distRoot = Join-Path $projectRoot "dist"
$packageRoot = Join-Path $distRoot "ROI_Lab_Portable_Web"
$zipPath = Join-Path $distRoot "ROI_Lab_Portable_Web.zip"
$webSource = Join-Path $projectRoot "web"
$portableReadme = Join-Path $projectRoot "docs\README_PORTABLE.txt"

if (-not (Test-Path $webSource)) {
    throw "Web directory not found: $webSource"
}

if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $packageRoot | Out-Null
Copy-Item -LiteralPath $webSource -Destination $packageRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "launch_offline.bat") -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "launch_roi_lab_tool.bat") -Destination $packageRoot
Copy-Item -LiteralPath $portableReadme -Destination $packageRoot

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Portable package created:"
Write-Host "Folder: $packageRoot"
Write-Host "Zip:    $zipPath"
