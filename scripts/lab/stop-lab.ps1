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
  if ($test.State -eq 'forbidden') {
    throw "Refusing shutdown: ownership mismatch for $($record.Name)."
  }
  if ($test.State -eq 'mismatch') {
    if ([string]$record.StopMode -ne 'targeted-process') {
      throw "Refusing shutdown: ownership mismatch for $($record.Name)."
    }
    $recordPort = [int]$record.Port
    if ($recordPort -ne 0 -and @(Get-LabListeners -Port $recordPort).Count -gt 0) {
      throw "Refusing shutdown: stale ownership record but port remains active for $($record.Name)."
    }
    Write-Output "Skipped stale process record for $($record.Name); no process was targeted."
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
  $phantomListenerConfirmed = $false
  Assert-SafeLabPath -Path $context.PostgresStopFile -Context $context | Out-Null
  Write-AtomicUtf8File -Path $context.PostgresStopFile -Content "$script:LabMarker`n"
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  do {
    $supervisorStillExists = $null -ne (Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$postgresSupervisor.Record.Pid)" -ErrorAction SilentlyContinue)
    if (-not $supervisorStillExists) { break }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($supervisorStillExists) {
    $supervisorRecheck = Test-LabProcessRecord -Record $postgresSupervisor.Record
    if (-not $supervisorRecheck.Owned) {
      throw 'PostgreSQL supervisor ownership changed during graceful shutdown.'
    }
    $remainingListeners = @(Get-LabListeners -Port 55439)
    if ($remainingListeners.Count -gt 0) {
      if ($null -eq $postgresListener) {
        throw 'PostgreSQL listener remains without a process document record.'
      }
      $listenerRecheck = Test-LabProcessRecord -Record $postgresListener.Record
      $listenerPids = @($remainingListeners | Select-Object -ExpandProperty OwningProcess -Unique)
      $loopbackOnly = @($remainingListeners | Where-Object {
        $_.LocalAddress -notin @('127.0.0.1', '::1')
      }).Count -eq 0
      $postmasterPidFile = Join-Path $context.PostgresData 'postmaster.pid'
      Assert-SafeLabPath -Path $postmasterPidFile -Context $context | Out-Null
      $postmasterLines = if (Test-Path -LiteralPath $postmasterPidFile -PathType Leaf) {
        @(Get-Content -LiteralPath $postmasterPidFile -TotalCount 4)
      } else { @() }
      $postmasterMatches = $postmasterLines.Count -eq 4 -and
        [string]$postmasterLines[0] -eq [string]$postgresListener.Record.Pid -and
        [System.IO.Path]::GetFullPath([string]$postmasterLines[1]) -eq $context.PostgresData -and
        [string]$postmasterLines[3] -eq '55439'
      $terminatingListenerMatches = $listenerRecheck.State -eq 'absent' -and
        $listenerPids.Count -eq 1 -and
        [int]$listenerPids[0] -eq [int]$postgresListener.Record.Pid -and
        $loopbackOnly -and $postmasterMatches
      if (-not $listenerRecheck.Owned -and -not $terminatingListenerMatches) {
        throw 'PostgreSQL listener ownership changed during graceful shutdown.'
      }
      $pgCtl = Join-Path $context.ApiRuntime `
        'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
      Assert-SafeLabPath -Path $pgCtl -Context $context | Out-Null
      Assert-SafeLabPath -Path $context.PostgresData -Context $context | Out-Null
      if (-not (Test-Path -LiteralPath $pgCtl -PathType Leaf)) {
        throw 'Owned embedded PostgreSQL control executable is absent.'
      }
      $previousErrorActionPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $pgCtlMessages = @(& $pgCtl 'stop' '-D' $context.PostgresData '-m' 'fast' '-w' '-t' '60' 2>&1)
        $pgCtlExitCode = $LASTEXITCODE
      } finally {
        $ErrorActionPreference = $previousErrorActionPreference
      }
      if ($pgCtlExitCode -eq 0) {
        Wait-LabPort -Port 55439 -State Free -TimeoutSeconds 30
        Write-Output 'Embedded PostgreSQL completed a targeted fast shutdown for the owned data directory.'
      } else {
        $listenerCim = Get-CimInstance Win32_Process `
          -Filter "ProcessId = $([int]$postgresListener.Record.Pid)" -ErrorAction SilentlyContinue
        $noSuchProcess = (($pgCtlMessages | ForEach-Object { [string]$_ }) -join "`n") -match 'No such process'
        if ($null -ne $listenerCim -or -not $terminatingListenerMatches -or -not $noSuchProcess) {
          throw 'Owned embedded PostgreSQL control command failed without proving an absent listener process.'
        }
        $phantomListenerConfirmed = $true
        Write-Output 'Confirmed an absent PostgreSQL process with a stale loopback listener record.'
      }
      Start-Sleep -Seconds 2
    }
    $supervisorRecheck = Test-LabProcessRecord -Record $postgresSupervisor.Record
    if ($supervisorRecheck.State -in @('mismatch', 'forbidden')) {
      throw 'PostgreSQL supervisor ownership changed before targeted cleanup.'
    }
    if ($supervisorRecheck.State -eq 'running') {
      if (@(Get-LabListeners -Port 55439).Count -gt 0 -and -not $phantomListenerConfirmed) {
        throw 'PostgreSQL listener remains; refusing targeted supervisor cleanup.'
      }
      Stop-Process -Id ([int]$postgresSupervisor.Record.Pid) -ErrorAction Stop
      Wait-Process -Id ([int]$postgresSupervisor.Record.Pid) -Timeout 15 -ErrorAction SilentlyContinue
    }
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
