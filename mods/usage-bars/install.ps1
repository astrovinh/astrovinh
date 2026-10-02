# Installs the usage-bars mod for the Claude Code desktop app (Windows PowerShell).
$ErrorActionPreference = "Stop"

$repo = "https://github.com/astrovinh/astrovinh"
$branch = "claude/usage-bars-mod"
$dest = Join-Path $HOME "astrovinh"
$mod = Join-Path $dest "mods\usage-bars"
$settings = Join-Path $HOME ".claude\settings.json"

if (Test-Path (Join-Path $dest ".git")) {
  git -C $dest fetch origin $branch
  git -C $dest checkout $branch
  git -C $dest pull --ff-only origin $branch
} else {
  git clone --branch $branch $repo $dest
}

New-Item -ItemType Directory -Force (Split-Path $settings) | Out-Null
$data = [ordered]@{}
if ((Test-Path $settings) -and (Get-Item $settings).Length -gt 0) {
  Copy-Item $settings "$settings.bak" -Force
  $data = Get-Content $settings -Raw | ConvertFrom-Json -AsHashtable
}
if (-not $data.ContainsKey("env")) { $data["env"] = @{} }
$dirs = @()
if ($data["env"].ContainsKey("CLAUDE_CODE_PLUGIN_DIRS")) {
  $dirs = $data["env"]["CLAUDE_CODE_PLUGIN_DIRS"] -split ";" | Where-Object { $_ }
}
if ($dirs -notcontains $mod) { $dirs += $mod }
$data["env"]["CLAUDE_CODE_PLUGIN_DIRS"] = $dirs -join ";"
$data | ConvertTo-Json -Depth 10 | Set-Content $settings

Write-Host "Done. Quit and reopen the Claude Code desktop app, then start a new LOCAL session."
Write-Host "Mod: $mod"
