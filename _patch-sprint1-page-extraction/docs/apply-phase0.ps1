$ErrorActionPreference = "Stop"

# Run from the BlueCode-OS repository root.
$repoRoot = (Get-Location).Path
$sourceDocs = $PSScriptRoot
$targetDocs = Join-Path $repoRoot "docs"

if (-not (Test-Path (Join-Path $repoRoot "docs\FRONTEND_ARCHITECTURE.md"))) {
    throw "Run this script from the BlueCode-OS repository root (docs\FRONTEND_ARCHITECTURE.md was not found)."
}

$files = @(
    "PRODUCT_UX_MAPPING.md",
    "PRODUCT_RULES_AND_ENTITLEMENTS.md",
    "MVP_CAPABILITY_GAP_ANALYSIS.md",
    "IMPLEMENTATION_ROADMAP.md"
)

New-Item -ItemType Directory -Path $targetDocs -Force | Out-Null

foreach ($file in $files) {
    $source = Join-Path $sourceDocs $file
    $target = Join-Path $targetDocs $file
    if (-not (Test-Path $source)) {
        throw "Patch file missing: $source"
    }
    if (Test-Path $target) {
        throw "Refusing to overwrite existing file: $target. Review/merge it manually."
    }
    Copy-Item -LiteralPath $source -Destination $target
    Write-Host "Added docs\$file"
}

Write-Host "`nPhase 0 documents added. Review with git status and git diff --no-index as needed."
