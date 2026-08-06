<#
.SYNOPSIS
  Creates one GitHub issue per file in docs/issues/, using the GitHub CLI.

.DESCRIPTION
  Each docs/issues/NN-slug.md file has YAML frontmatter (id, title, priority,
  area, effort, status). This script reads them, creates the matching labels if
  absent, and opens one issue per file with the markdown body below the
  frontmatter.

  Issues marked `status: done` are skipped. The markdown files are left in place
  as the offline copy of the backlog.

  Requires: gh CLI installed and authenticated (`gh auth login`).

.PARAMETER DryRun
  Print what would be created without calling the GitHub API. Run this first.

.PARAMETER Only
  Create just these issue ids, e.g. -Only 01,07,15

.EXAMPLE
  ./scripts/create-github-issues.ps1 -DryRun
  ./scripts/create-github-issues.ps1
  ./scripts/create-github-issues.ps1 -Only 01,02,03
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  [string[]]$Only
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$issueDir = Join-Path $repoRoot 'docs\issues'

if (-not (Test-Path $issueDir)) {
  throw "Issue directory not found: $issueDir"
}

# gh is only needed to actually create issues. -DryRun stays usable without it
# so the backlog files can be validated before installing anything.
if (-not $DryRun) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "gh CLI not found. Install with: winget install GitHub.cli   then: gh auth login"
  }
  # Fails loudly if not authenticated, before creating anything.
  gh auth status
  if (-not $?) { throw "gh is not authenticated. Run: gh auth login" }
}

# Label colours by priority band and area. Created on demand; existing labels
# are left alone.
$labelColors = @{
  'priority:P0'   = 'b60205'
  'priority:P1'   = 'd93f0b'
  'priority:P2'   = 'fbca04'
  'priority:P3'   = '0e8a16'
  'priority:P4'   = 'c5def5'
  'launch-blocker'= 'b60205'
  'security'      = 'd93f0b'
  'bug'           = 'd73a4a'
  'legal'         = '5319e7'
  'product'       = '1d76db'
  'performance'   = '0052cc'
  'accessibility' = '006b75'
  'testing'       = 'bfd4f2'
  'docs'          = '0075ca'
  'ci'            = 'ededed'
  'hygiene'       = 'ededed'
  'content'       = 'f9d0c4'
  'process'       = 'ededed'
}

function Get-Frontmatter {
  param([string[]]$Lines)

  if ($Lines[0].Trim() -ne '---') { return $null }

  $meta = @{}
  $bodyStart = $null
  for ($i = 1; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i].Trim() -eq '---') { $bodyStart = $i + 1; break }
    $kv = $Lines[$i] -split ':', 2
    if ($kv.Count -eq 2) {
      $key = $kv[0].Trim()
      # Strip surrounding quotes, then unescape YAML-escaped inner quotes so a
      # title containing "..." survives round-tripping.
      $val = $kv[1].Trim().Trim('"').Replace('\"', '"')
      $meta[$key] = $val
    }
  }
  if ($null -eq $bodyStart) { return $null }

  return @{
    Meta = $meta
    Body = ($Lines[$bodyStart..($Lines.Count - 1)] -join "`n").Trim()
  }
}

$files = Get-ChildItem -Path $issueDir -Filter '*.md' |
  Where-Object { $_.Name -match '^\d\d-' } |
  Sort-Object Name

$ensuredLabels = @{}
$created = 0
$skipped = 0

# Normalize -Only to zero-padded 2-digit strings. Necessary because PowerShell
# parses an unquoted `01` as the integer 1, which would never match the string
# "01" from the frontmatter, silently matching nothing.
$onlyNorm = @()
foreach ($o in $Only) {
  $n = 0
  if ([int]::TryParse($o, [ref]$n)) {
    $onlyNorm += $n.ToString('00')
  } else {
    Write-Warning "-Only value '$o' is not a number, ignoring"
  }
}
if ($Only -and -not $onlyNorm) {
  throw "-Only was given but no valid issue ids were parsed from it."
}

foreach ($file in $files) {
  $lines = Get-Content -LiteralPath $file.FullName
  $parsed = Get-Frontmatter -Lines $lines

  if ($null -eq $parsed) {
    Write-Warning "$($file.Name): no frontmatter, skipping"
    $skipped++
    continue
  }

  $meta = $parsed.Meta
  $id       = $meta['id']
  $title    = $meta['title']
  $priority = $meta['priority']
  $area     = $meta['area']
  $effort   = $meta['effort']
  $status   = $meta['status']

  if (-not $title) {
    Write-Warning "$($file.Name): no title, skipping"
    $skipped++
    continue
  }

  if ($status -eq 'done') {
    Write-Host "skip  #$id  (status: done)" -ForegroundColor DarkGray
    $skipped++
    continue
  }

  $idNorm = $id
  $idInt = 0
  if ([int]::TryParse($id, [ref]$idInt)) { $idNorm = $idInt.ToString('00') }

  if ($onlyNorm -and ($onlyNorm -notcontains $idNorm)) {
    $skipped++
    continue
  }

  $labels = @()
  if ($priority) { $labels += "priority:$priority" }
  if ($area)     { $labels += $area }

  # Body gets a pointer back to the in-repo file, so the two don't drift silently.
  $body = @"
$($parsed.Body)

---

*Effort: $effort. Source of truth for this issue lives in the repo at
``docs/issues/$($file.Name)`` — see ``docs/issues/README.md`` for the full backlog
and the dependency graph.*
"@

  $labelText = if ($labels) { $labels -join ', ' } else { '(none)' }

  if ($DryRun) {
    Write-Host ""
    Write-Host "would create #$id" -ForegroundColor Cyan
    Write-Host "  title:  $title"
    Write-Host "  labels: $labelText"
    Write-Host "  body:   $($body.Length) chars"
    $created++
    continue
  }

  # Create any labels this issue needs that we haven't ensured yet this run.
  foreach ($label in $labels) {
    if ($ensuredLabels.ContainsKey($label)) { continue }
    $color = $labelColors[$label]
    if (-not $color) { $color = 'ededed' }
    try {
      gh label create $label --color $color --description "scoundrel backlog" 2>$null | Out-Null
    } catch {
      # Already exists, or insufficient permissions. Either way the issue
      # create below will tell us if the label is genuinely unusable.
    }
    $ensuredLabels[$label] = $true
  }

  $bodyFile = Join-Path $env:TEMP "scoundrel-issue-$id.md"
  Set-Content -LiteralPath $bodyFile -Value $body -Encoding utf8

  $ghArgs = @('issue', 'create', '--title', $title, '--body-file', $bodyFile)
  foreach ($label in $labels) { $ghArgs += @('--label', $label) }

  $url = & gh @ghArgs
  if ($LASTEXITCODE -eq 0) {
    Write-Host "created #$id  $url" -ForegroundColor Green
    $created++
  } else {
    Write-Warning "failed to create #$id ($title)"
    $skipped++
  }

  Remove-Item -LiteralPath $bodyFile -ErrorAction SilentlyContinue
}

Write-Host ""
if ($DryRun) {
  Write-Host "Dry run: $created would be created, $skipped skipped." -ForegroundColor Cyan
  Write-Host "Re-run without -DryRun to create them."
} else {
  Write-Host "Done: $created created, $skipped skipped." -ForegroundColor Green
}
