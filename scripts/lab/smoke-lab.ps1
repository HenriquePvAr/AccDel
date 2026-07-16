[CmdletBinding()]
param([switch]$DryRun)

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
Assert-LabBranch -Context $context | Out-Null
Assert-CleanLabWorktree -Context $context
$document = Read-LabProcessDocument -Context $context
if ($null -eq $document) { throw 'Laboratory is not running.' }
foreach ($record in @($document.records)) {
  $test = Test-LabProcessRecord -Record $record
  if (-not $test.Owned) { throw "Runtime ownership validation failed for $($record.Name)." }
}

$runtime = Get-LabRuntimeEnvironment -Context $context
if ($DryRun) {
  Write-Output 'Would run loopback health, integrated pilot flows, dry-run artifact hashes and secret-log scan.'
  return
}

$health = Invoke-RestMethod -Uri 'http://127.0.0.1:3333/health' -TimeoutSec 5
if ($health.status -ne 'ok') { throw 'API health is not ok.' }

$flowEnvironment = @{
  PILOT_API_URL = 'http://127.0.0.1:3333'
  PILOT_CREDENTIALS_FILE = $context.SeedCredentials
}
Invoke-LabExternal -FilePath (Get-Command node.exe).Source `
  -Arguments @((Join-Path $context.Root 'scripts\test-pilot-flows.mjs')) `
  -WorkingDirectory $context.Root -Environment $flowEnvironment

Start-Sleep -Seconds 2
$outputDirectory = Join-Path $context.PrintData 'print-output'
$metadataFiles = @(Get-ChildItem -LiteralPath $outputDirectory -Filter '*.json' -File -ErrorAction Stop)
if ($metadataFiles.Count -eq 0) { throw 'Dry-run produced no metadata artifacts.' }
foreach ($metadataFile in $metadataFiles) {
  $base = Join-Path $outputDirectory $metadataFile.BaseName
  $binary = "$base.bin"
  $text = "$base.txt"
  if (-not (Test-Path -LiteralPath $binary) -or -not (Test-Path -LiteralPath $text)) {
    throw "Dry-run artifact trio is incomplete for $($metadataFile.BaseName)."
  }
  $metadata = Get-Content -Raw -LiteralPath $metadataFile.FullName | ConvertFrom-Json
  $binaryHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $binary).Hash.ToLowerInvariant()
  if ($binaryHash -ne [string]$metadata.contentHash) { throw 'Dry-run binary hash mismatch.' }
  if ((Get-Item -LiteralPath $text).Length -eq 0) { throw 'Dry-run text artifact is empty.' }
}
if (@(Get-ChildItem -LiteralPath $outputDirectory -Filter '*.tmp' -File).Count -gt 0) {
  throw 'Temporary print artifacts remain after atomic writes.'
}

$ledgerPath = Join-Path $context.PrintData 'print-ledger.json'
$ledger = Get-Content -Raw -LiteralPath $ledgerPath | ConvertFrom-Json
$records = @($ledger.records.PSObject.Properties | ForEach-Object { $_.Value })
$unsafeStates = @($records | Where-Object { $_.state -in @('CLAIMED','SENDING','SENT_UNCONFIRMED','FAILURE_UNCONFIRMED') })
if ($unsafeStates.Count -gt 0) { throw 'Print ledger contains incomplete recovery states.' }

$secretValues = @(
  $runtime.POSTGRES_PASSWORD,
  $runtime.JWT_ACCESS_SECRET,
  $runtime.PILOT_USER_PASSWORD,
  $runtime.CAIN_PRINT_AGENT_TOKEN
) | Where-Object { $_ }
$logFiles = @(Get-ChildItem -LiteralPath $context.LogDirectory -Filter '*.log' -File -ErrorAction SilentlyContinue)
foreach ($logFile in $logFiles) {
  $content = [System.IO.File]::ReadAllText($logFile.FullName)
  foreach ($secret in $secretValues) {
    if ($content.Contains([string]$secret)) { throw 'A runtime secret appeared in an owned log.' }
  }
}

$result = [ordered]@{
  marker = $script:LabMarker
  completedAtUtc = [DateTime]::UtcNow.ToString('o')
  health = 'ok'
  integratedFlows = 'passed'
  artifactSets = $metadataFiles.Count
  ledgerRecords = $records.Count
  externalProviders = 'disabled'
  printerMode = 'dry-run'
  secretsInLogs = $false
}
Write-LabJson -Path $context.SmokeResult -Value $result
$result | ConvertTo-Json
