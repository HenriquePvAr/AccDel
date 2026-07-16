[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$ConfirmReset
)

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
Assert-LabBranch -Context $context | Out-Null
Assert-CleanLabWorktree -Context $context

if (-not (Test-Path -LiteralPath $context.Runtime)) {
  Write-Output 'No laboratory runtime data exists.'
  return
}
$runtime = Assert-SafeLabPath -Path $context.Runtime -Context $context
if (-not (Test-Path -LiteralPath $context.OwnerFile)) {
  throw 'Owned laboratory marker is missing; refusing recursive cleanup.'
}
$owner = Get-Content -Raw -LiteralPath $context.OwnerFile | ConvertFrom-Json
if ($owner.marker -ne $script:LabMarker -or [string]$owner.projectRoot -ne $context.Root) {
  throw 'Owned laboratory marker does not match this project.'
}

$document = Read-LabProcessDocument -Context $context
if ($null -ne $document) {
  foreach ($record in @($document.records)) {
    $test = Test-LabProcessRecord -Record $record
    if ($test.State -ne 'absent') {
      throw 'Laboratory processes may still exist; run stop-lab.ps1 first.'
    }
  }
}

if ($DryRun) {
  Write-Output "Would remove only owned runtime: $runtime"
  return
}
if (-not $ConfirmReset) {
  throw 'Explicit -ConfirmReset is required to remove fictitious lab data.'
}
Remove-Item -LiteralPath $runtime -Recurse -Force
Write-Output 'Owned fictitious database, credentials, logs and dry-run outputs were removed.'
