[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
Assert-LabBranch -Context $context | Out-Null
$document = Read-LabProcessDocument -Context $context
if ($null -eq $document) {
  Write-Output 'Cain laboratory is stopped: no owned process document exists.'
  return
}

$results = foreach ($record in @($document.records)) {
  $test = Test-LabProcessRecord -Record $record
  [pscustomobject]@{
    Name = $record.Name
    Pid = $record.Pid
    State = $test.State
    Ownership = if ($test.Owned) { 'validated' } else { $test.Reason }
    Port = if ([int]$record.Port -eq 0) { '-' } else { [int]$record.Port }
  }
}
$results | Format-Table -AutoSize

$bad = @($results | Where-Object { $_.State -ne 'running' })
if ($bad.Count -gt 0) { throw 'One or more laboratory processes failed ownership/status validation.' }

$httpChecks = @(
  @{ Name = 'API health'; Url = 'http://127.0.0.1:3333/health' },
  @{ Name = 'Admin'; Url = 'http://127.0.0.1:4173/' },
  @{ Name = 'Waiter'; Url = 'http://127.0.0.1:4174/' }
)
foreach ($item in $httpChecks) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $item.Url -TimeoutSec 5
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
    throw "$($item.Name) returned HTTP $($response.StatusCode)."
  }
  Write-Output "$($item.Name): HTTP $($response.StatusCode)"
}
Write-Output 'Cain laboratory status: running and ownership-validated.'
