#Requires -Version 5.1
<#
.SYNOPSIS
  git pull latest kcw-v2, then run Codex non-interactively against bank-match prompt(s).

.PARAMETER Account
  4-digit account ending (0393, 1139, 3557, 4759, 6184, 7236) or "all".

.PARAMETER Month
  Target month as YYYY-MM. Injected as {{from}}=first day, {{to}}=last day.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Account,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}$')]
  [string]$Month
)

$ErrorActionPreference = "Stop"

# account ending -> full bank.statement_lines.account_no (must match BANK_MATCH_PROMPTS)
$AccountMap = [ordered]@{
  "7236" = "064-8-91723-6"
  "3557" = "141-1-72355-7"
  "0393" = "064-8-92039-3"
  "4759" = "233-1-18475-9"
  "1139" = "248-0-42113-9"
  "6184" = "248-6-00618-4"
}

function Write-Info([string]$Message) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$ts] $Message"
}

function Resolve-RepoRoot {
  # Prefer the directory that contains both prompts\ and this script's parent.
  $here = Split-Path -Parent $PSScriptRoot
  if (Test-Path (Join-Path $here "prompts")) { return (Resolve-Path $here).Path }
  return (Resolve-Path (Get-Location)).Path
}

function Resolve-CodexExe {
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $binRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
  if (Test-Path $binRoot) {
    $found = Get-ChildItem -Path $binRoot -Filter "codex.exe" -Recurse -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }

  throw "codex.exe not found. Open the ChatGPT/Codex app once (to keep CLI present) or install Codex CLI and ensure it is on PATH."
}

function Get-MonthBounds([string]$YyyyMm) {
  $parts = $YyyyMm.Split("-")
  $year = [int]$parts[0]
  $month = [int]$parts[1]
  if ($month -lt 1 -or $month -gt 12) {
    throw "Invalid month in '$YyyyMm' (expected 01-12)."
  }
  $fromDate = Get-Date -Year $year -Month $month -Day 1
  $toDate = $fromDate.AddMonths(1).AddDays(-1)
  return [pscustomobject]@{
    From = $fromDate.ToString("yyyy-MM-dd")
    To   = $toDate.ToString("yyyy-MM-dd")
  }
}

function Get-TargetAccounts([string]$Raw) {
  $key = $Raw.Trim().ToLowerInvariant()
  if ($key -eq "all") {
    return @($AccountMap.Keys)
  }

  # allow 393 as well as 0393
  if ($key -match '^\d{3,4}$') {
    $key = $key.PadLeft(4, "0")
  }

  if (-not $AccountMap.Contains($key)) {
    $known = ($AccountMap.Keys -join ", ")
    throw "Unknown account '$Raw'. Use one of: $known, or all."
  }
  return @($key)
}

function Build-FilledPrompt {
  param(
    [string]$RepoRoot,
    [string]$Ending,
    [string]$AccountNo,
    [string]$From,
    [string]$To
  )

  $promptRel = "prompts\bank-statement-match-$Ending.md"
  $promptPath = Join-Path $RepoRoot $promptRel
  if (-not (Test-Path $promptPath)) {
    throw "Prompt not found: $promptPath"
  }

  $template = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8
  $filled = $template.
    Replace("{{account_no}}", $AccountNo).
    Replace("{{from}}", $From).
    Replace("{{to}}", $To)

  $wrapper = @"
You are running unattended via the local Windows worker BAT/PowerShell entrypoint.
Execute the bank-statement match job below exactly. Do not ask clarifying questions.

Hard requirements:
1. Scope is already injected: account_no=$AccountNo, from=$From, to=$To.
2. Follow the fetched prompt rules strictly.
3. Read/write Supabase ``bank.statement_lines`` directly (prefer configured Supabase MCP / SQL tools; otherwise use project secrets/env available on this machine).
4. Never change money/source fields. Only write match_* / matched_* fields as the prompt allows.
5. When finished, print the end-of-run summary exactly as the prompt requests, then stop.

----- BEGIN MATCH PROMPT ($promptRel) -----
$filled
----- END MATCH PROMPT -----
"@
  return $wrapper
}

function Invoke-CodexPrompt {
  param(
    [string]$CodexExe,
    [string]$RepoRoot,
    [string]$PromptText,
    [string]$Label
  )

  $tmp = Join-Path $env:TEMP ("kcw-bank-match-{0}-{1}.md" -f $Label, [guid]::NewGuid().ToString("N"))
  try {
    # UTF-8 without BOM keeps special Thai characters intact for Codex stdin.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tmp, $PromptText, $utf8NoBom)

    Write-Info "Starting Codex for $Label"

    # Non-interactive worker needs full access:
    # prompts update hosted Supabase (network) and must never block on approval UI.
    # `codex exec` accepts --sandbox / --dangerously-bypass-approvals-and-sandbox
    # but not the short `-a` flag used by the interactive CLI.
    $argList = @(
      "exec",
      "--skip-git-repo-check",
      "-C", $RepoRoot,
      "--sandbox", "danger-full-access",
      "--dangerously-bypass-approvals-and-sandbox",
      "-"
    )

    Push-Location -LiteralPath $RepoRoot
    try {
      # Pipe prompt file into `codex exec -` (more reliable than Start-Process stdin
      # when paths contain spaces, e.g. "Windows 11").
      Get-Content -LiteralPath $tmp -Raw -Encoding UTF8 | & $CodexExe @argList
      if ($LASTEXITCODE -ne 0) {
        throw "Codex failed for $Label (exit $LASTEXITCODE)."
      }
    }
    finally {
      Pop-Location
    }

    Write-Info "Codex finished for $Label"
  }
  finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

# --- main ---
$repoRoot = Resolve-RepoRoot
Set-Location -LiteralPath $repoRoot
Write-Info "Repo: $repoRoot"

Write-Info "git pull --ff-only"
git -C $repoRoot pull --ff-only
if ($LASTEXITCODE -ne 0) {
  throw "git pull failed (exit $LASTEXITCODE)."
}

$bounds = Get-MonthBounds -YyyyMm $Month
$endings = Get-TargetAccounts -Raw $Account
$codex = Resolve-CodexExe
Write-Info "Codex: $codex"
Write-Info ("Month {0} => {1} .. {2}" -f $Month, $bounds.From, $bounds.To)
Write-Info ("Accounts: {0}" -f ($endings -join ", "))

$failed = New-Object System.Collections.Generic.List[string]

foreach ($ending in $endings) {
  $accountNo = $AccountMap[$ending]
  try {
    $prompt = Build-FilledPrompt -RepoRoot $repoRoot -Ending $ending -AccountNo $accountNo -From $bounds.From -To $bounds.To
    Invoke-CodexPrompt -CodexExe $codex -RepoRoot $repoRoot -PromptText $prompt -Label ("{0}-{1}" -f $ending, $Month)
  }
  catch {
    Write-Host "ERROR on account $ending ($accountNo): $($_.Exception.Message)" -ForegroundColor Red
    $failed.Add($ending) | Out-Null
  }
}

if ($failed.Count -gt 0) {
  throw ("Finished with failures: {0}" -f ($failed -join ", "))
}

Write-Info "All requested match jobs completed successfully."
