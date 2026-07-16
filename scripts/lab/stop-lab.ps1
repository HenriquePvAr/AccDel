[CmdletBinding()]
param([switch]$InternalCleanup)

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
Assert-LabBranch -Context $context | Out-Null
Assert-CleanLabWorktree -Context $context
$document = Read-LabProcessDocument -Context $context
if ($null -eq $document) {
  Write-Output 'Cain laboratory is already stopped.'
  return
}

$validated = @()
foreach ($record in @($document.records)) {
  $test = Test-LabProcessRecord -Record $record
  if ($test.State -in @('mismatch', 'forbidden')) {
    throw "Refusing shutdown: ownership mismatch for $($record.Name)."
  }
  $validated += [pscustomobject]@{ Record = $record; Test = $test }
}

$postgresSupervisors = @($validated | Where-Object { $_.Record.StopMode -eq 'postgres-supervisor' })
$postgresListeners = @($validated | Where-Object { $_.Record.StopMode -eq 'postgres-listener' })
if ($postgresSupervisors.Count -gt 1 -or $postgresListeners.Count -gt 1) {
  throw 'Process document contains duplicate PostgreSQL ownership records.'
}
$postgresSupervisor = if ($postgresSupervisors.Count -eq 1) { $postgresSupervisors[0] } else { $null }
$postgresListener = if ($postgresListeners.Count -eq 1) { $postgresListeners[0] } else { $null }
$supervisorState = if ($null -eq $postgresSupervisor) { 'absent' } else { $postgresSupervisor.Test.State }
$listenerState = if ($null -eq $postgresListener) { 'absent' } else { $postgresListener.Test.State }
if ($listenerState -eq 'running' -and $supervisorState -ne 'running') {
  throw 'PostgreSQL listener exists without its validated supervisor; refusing inferred shutdown.'
}

$targets = @($validated | Where-Object {
  $_.Test.State -eq 'running' -and $_.Record.StopMode -eq 'targeted-process'
})
[Array]::Reverse($targets)
foreach ($item in $targets) {
  $record = $item.Record
  $recheck = Test-LabProcessRecord -Record $record
  if (-not $recheck.Owned) { throw "Ownership changed before stopping $($record.Name)." }
  Stop-Process -Id ([int]$record.Pid) -ErrorAction Stop
  Wait-Process -Id ([int]$record.Pid) -Timeout 15 -ErrorAction SilentlyContinue
  Write-Output "Stopped owned process $($record.Name) PID $($record.Pid)."
}

if ($supervisorState -eq 'running') {
  Assert-SafeLabPath -Path $context.PostgresStopFile -Context $context | Out-Null
  Write-AtomicUtf8File -Path $context.PostgresStopFile -Content "$script:LabMarker`n"
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  do {
    $supervisorStillExists = $null -ne (Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$postgresSupervisor.Record.Pid)" -ErrorAction SilentlyContinue)
    if (-not $supervisorStillExists) { break }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($supervisorStillExists) {
    $remainingListeners = @(Get-LabListeners -Port 55439)
    $supervisorRecheck = Test-LabProcessRecord -Record $postgresSupervisor.Record
    if ($remainingListeners.Count -gt 0 -or -not $supervisorRecheck.Owned) {
      throw 'PostgreSQL supervisor did not complete graceful shutdown; ownership or listener state blocks targeted cleanup.'
    }
    Stop-Process -Id ([int]$postgresSupervisor.Record.Pid) -ErrorAction Stop
    Wait-Process -Id ([int]$postgresSupervisor.Record.Pid) -Timeout 15 -ErrorAction SilentlyContinue
    $supervisorStillExists = $null -ne (Get-CimInstance Win32_Process `
      -Filter "ProcessId = $([int]$postgresSupervisor.Record.Pid)" -ErrorAction SilentlyContinue)
    if ($supervisorStillExists) {
      throw 'Validated orphaned PostgreSQL supervisor did not exit after targeted cleanup.'
    }
    Write-Output 'Stopped validated orphaned PostgreSQL supervisor after its listener exited.'
  }
  Wait-LabPort -Port 55439 -State Free -TimeoutSeconds 30
  Write-Output 'PostgreSQL laboratory supervisor completed graceful shutdown.'
} elseif ($listenerState -eq 'running') {
  throw 'PostgreSQL listener remains without a running supervisor; no process was terminated.'
}

foreach ($path in @($context.PostgresReadyFile, $context.PostgresStopFile, $context.ProcessFile)) {
  if (Test-Path -LiteralPath $path) {
    Assert-SafeLabPath -Path $path -Context $context | Out-Null
    Remove-Item -LiteralPath $path -Force
  }
}
Assert-LabPortsFree
Write-Output 'Cain laboratory stopped. Only owned runtime data remains for explicit reset.'
