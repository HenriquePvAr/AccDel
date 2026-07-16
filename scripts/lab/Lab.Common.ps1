Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:LabMarker = 'CAIN_LAB_RUNTIME_V1'
$script:LabBranch = 'lab/pilot-hardware-homologation'
$script:LabPorts = @(3333, 4173, 4174, 55439)

function Get-LabContext {
  $root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
  if ($root -match '(?i)\\OneDrive\\') {
    throw 'Laboratory scripts refuse to run from OneDrive.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $root '.git')) -or
      -not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) {
    throw "Project root validation failed: $root"
  }

  $runtime = Join-Path $root '.pilot\lab'
  [pscustomobject]@{
    Root = $root
    Runtime = $runtime
    ApiRuntime = Join-Path $runtime 'api-src'
    ProcessFile = Join-Path $runtime 'processes.json'
    RuntimeEnvFile = Join-Path $runtime 'runtime.env'
    OwnerFile = Join-Path $runtime 'owner.json'
    LogDirectory = Join-Path $runtime 'logs'
    PostgresData = Join-Path $runtime 'postgres-data'
    PostgresReadyFile = Join-Path $runtime 'postgres.ready.json'
    PostgresStopFile = Join-Path $runtime 'postgres.stop'
    PrintData = Join-Path $runtime 'print-agent'
    SeedCredentials = Join-Path $runtime 'seed-credentials.txt'
    SmokeResult = Join-Path $runtime 'smoke-result.json'
  }
}

function Assert-LabBranch {
  param([Parameter(Mandatory)]$Context)
  $branch = (& git -C $Context.Root branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $script:LabBranch) {
    throw "Laboratory scripts require branch $script:LabBranch. Current: $branch"
  }
  return $branch
}

function Assert-CleanLabWorktree {
  param([Parameter(Mandatory)]$Context)
  $status = @(& git -C $Context.Root status --porcelain)
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Git worktree.' }
  if ($status.Count -gt 0) {
    throw 'Laboratory startup requires a clean worktree.'
  }
}

function Assert-SafeLabPath {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)]$Context
  )
  $rootPrefix = $Context.Root.TrimEnd('\') + '\'
  $resolved = [System.IO.Path]::GetFullPath($Path)
  if (-not ($resolved + '\').StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes project root: $resolved"
  }
  if ($resolved -notmatch '(?i)\\\.pilot\\lab(?:\\|$)') {
    throw "Path is outside the owned lab runtime: $resolved"
  }
  return $resolved
}

function Assert-AllowedLabPort {
  param([Parameter(Mandatory)][int]$Port)
  if ($Port -notin $script:LabPorts) {
    throw "Port $Port is not in the laboratory allowlist."
  }
}

function Get-LabListeners {
  param([Parameter(Mandatory)][int]$Port)
  Assert-AllowedLabPort -Port $Port
  return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Assert-LabPortsFree {
  foreach ($port in $script:LabPorts) {
    $listeners = @(Get-LabListeners -Port $port)
    if ($listeners.Count -gt 0) {
      $owners = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ','
      throw "Laboratory port $port is already in use by PID(s) $owners."
    }
  }
}

function Wait-LabPort {
  param(
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][ValidateSet('Listening', 'Free')][string]$State,
    [int]$TimeoutSeconds = 30
  )
  Assert-AllowedLabPort -Port $Port
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    $count = @(Get-LabListeners -Port $Port).Count
    if (($State -eq 'Listening' -and $count -gt 0) -or
        ($State -eq 'Free' -and $count -eq 0)) {
      return
    }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Port $Port did not become $State within $TimeoutSeconds seconds."
}

function Test-PrivateLabHost {
  param([Parameter(Mandatory)][string]$HostName)
  if ($HostName -in @('127.0.0.1', 'localhost')) { return $true }
  $address = $null
  if (-not [System.Net.IPAddress]::TryParse($HostName, [ref]$address)) { return $false }
  $bytes = $address.GetAddressBytes()
  if ($bytes.Length -ne 4) { return $false }
  return ($bytes[0] -eq 10) -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
}

function New-LabSecret {
  param([int]$ByteCount = 32)
  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Write-AtomicUtf8File {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Content
  )
  $directory = Split-Path -Parent $Path
  [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  $temporary = "$Path.tmp"
  [System.IO.File]::WriteAllText($temporary, $Content, (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Write-LabJson {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)]$Value
  )
  Write-AtomicUtf8File -Path $Path -Content (($Value | ConvertTo-Json -Depth 12) + "`n")
}

function Read-LabEnvironment {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Runtime environment is missing: $Path" }
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -le 0) { throw 'Invalid runtime environment line.' }
    $values[$trimmed.Substring(0, $separator)] = $trimmed.Substring($separator + 1)
  }
  return $values
}

function Use-LabEnvironment {
  param(
    [Parameter(Mandatory)][hashtable]$Values,
    [Parameter(Mandatory)][scriptblock]$Script
  )
  $previous = @{}
  try {
    foreach ($key in $Values.Keys) {
      $item = Get-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue
      $previous[$key] = if ($null -eq $item) { $null } else { $item.Value }
      Set-Item -LiteralPath "Env:$key" -Value ([string]$Values[$key])
    }
    & $Script
  } finally {
    foreach ($key in $Values.Keys) {
      if ($null -eq $previous[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
      else { Set-Item -LiteralPath "Env:$key" -Value $previous[$key] }
    }
  }
}

function Invoke-LabExternal {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [hashtable]$Environment = @{}
  )
  Push-Location $WorkingDirectory
  try {
    Use-LabEnvironment -Values $Environment -Script {
      & $FilePath @Arguments
      if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $FilePath" }
    }
  } finally {
    Pop-Location
  }
}

function ConvertTo-LabArgumentLine {
  param([string[]]$Arguments)
  return ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }) -join ' '
}

function Start-LabNodeProcess {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string[]]$Arguments,
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [Parameter(Mandatory)][string]$LogDirectory,
    [hashtable]$Environment = @{},
    [int]$Port = 0,
    [string[]]$CommandFragments = @()
  )
  if ($Port -ne 0) { Assert-AllowedLabPort -Port $Port }
  [System.IO.Directory]::CreateDirectory($LogDirectory) | Out-Null
  $stdout = Join-Path $LogDirectory "$Name.stdout.log"
  $stderr = Join-Path $LogDirectory "$Name.stderr.log"
  Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $argumentLine = ConvertTo-LabArgumentLine -Arguments $Arguments
  $process = Use-LabEnvironment -Values $Environment -Script {
    Start-Process -FilePath $node -ArgumentList $argumentLine -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  }
  Start-Sleep -Milliseconds 250
  $process.Refresh()
  if ($process.HasExited) { throw "$Name exited during startup. Inspect the owned lab logs." }
  $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)" -ErrorAction Stop
  if (-not $cim.CommandLine) { throw "Cannot validate command line for $Name PID $($process.Id)." }
  foreach ($fragment in $CommandFragments) {
    if ($cim.CommandLine.IndexOf($fragment, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "Startup ownership validation failed for $Name."
    }
  }
  [pscustomobject]@{
    Name = $Name
    Pid = [int]$process.Id
    CreatedAtUtc = $cim.CreationDate.ToUniversalTime().ToString('o')
    ExecutableName = [string]$cim.Name
    CommandFragments = @($CommandFragments)
    Port = [int]$Port
    StopMode = 'targeted-process'
  }
}

function New-LabListenerRecord {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][string[]]$CommandFragments,
    [Parameter(Mandatory)][string]$StopMode
  )
  $listeners = @(Get-LabListeners -Port $Port)
  if ($listeners.Count -lt 1) { throw "Expected a listener on laboratory port $Port." }
  $nonLoopback = @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })
  if ($nonLoopback.Count -gt 0) { throw "Laboratory port $Port is exposed beyond loopback." }
  $listenerPids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($listenerPids.Count -ne 1) { throw "Expected exactly one owner for laboratory port $Port." }
  $pidValue = [int]$listenerPids[0]
  if ($pidValue -eq 9444) { throw 'Forbidden PID cannot become a laboratory owner.' }
  $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue" -ErrorAction Stop
  if (-not $cim.CommandLine) { throw "Cannot validate listener PID $pidValue." }
  foreach ($fragment in $CommandFragments) {
    if ($cim.CommandLine.IndexOf($fragment, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "Listener ownership validation failed for $Name."
    }
  }
  [pscustomobject]@{
    Name = $Name
    Pid = $pidValue
    CreatedAtUtc = $cim.CreationDate.ToUniversalTime().ToString('o')
    ExecutableName = [string]$cim.Name
    CommandFragments = @($CommandFragments)
    Port = $Port
    StopMode = $StopMode
  }
}

function Test-LabProcessRecord {
  param([Parameter(Mandatory)]$Record)
  $pidValue = [int]$Record.Pid
  if ($pidValue -eq 9444) {
    return [pscustomobject]@{ Owned = $false; State = 'forbidden'; Reason = 'Forbidden PID in runtime record.' }
  }
  $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue" -ErrorAction SilentlyContinue
  if ($null -eq $cim) {
    return [pscustomobject]@{ Owned = $false; State = 'absent'; Reason = 'Process no longer exists.' }
  }
  if ([string]$cim.Name -ne [string]$Record.ExecutableName -or -not $cim.CommandLine) {
    return [pscustomobject]@{ Owned = $false; State = 'mismatch'; Reason = 'Image or command line mismatch.' }
  }
  $expectedTime = [DateTime]::Parse([string]$Record.CreatedAtUtc).ToUniversalTime()
  $actualTime = $cim.CreationDate.ToUniversalTime()
  if ([Math]::Abs(($actualTime - $expectedTime).TotalSeconds) -gt 2) {
    return [pscustomobject]@{ Owned = $false; State = 'mismatch'; Reason = 'Creation time mismatch.' }
  }
  foreach ($fragment in @($Record.CommandFragments)) {
    if ($cim.CommandLine.IndexOf([string]$fragment, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      return [pscustomobject]@{ Owned = $false; State = 'mismatch'; Reason = 'Command line fragment mismatch.' }
    }
  }
  $port = [int]$Record.Port
  if ($port -ne 0) {
    $listeners = @(Get-LabListeners -Port $port)
    $listenerPids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($listenerPids.Count -ne 1 -or [int]$listenerPids[0] -ne $pidValue) {
      return [pscustomobject]@{ Owned = $false; State = 'mismatch'; Reason = 'Expected listener ownership mismatch.' }
    }
    if ([string]$Record.StopMode -eq 'postgres-listener' -and
        @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -gt 0) {
      return [pscustomobject]@{ Owned = $false; State = 'mismatch'; Reason = 'PostgreSQL listener is exposed beyond loopback.' }
    }
  }
  return [pscustomobject]@{ Owned = $true; State = 'running'; Reason = 'Ownership validated.' }
}

function Read-LabProcessDocument {
  param([Parameter(Mandatory)]$Context)
  if (-not (Test-Path -LiteralPath $Context.ProcessFile)) { return $null }
  $document = Get-Content -Raw -LiteralPath $Context.ProcessFile | ConvertFrom-Json
  if ($document.marker -ne $script:LabMarker -or
      [string]$document.projectRoot -ne $Context.Root) {
    throw 'Process document ownership marker is invalid.'
  }
  return $document
}

function Write-LabProcessDocument {
  param(
    [Parameter(Mandatory)]$Context,
    [Parameter(Mandatory)][object[]]$Records
  )
  Write-LabJson -Path $Context.ProcessFile -Value ([ordered]@{
    marker = $script:LabMarker
    projectRoot = $Context.Root
    branch = $script:LabBranch
    writtenAtUtc = [DateTime]::UtcNow.ToString('o')
    records = @($Records)
  })
}

function Get-LabRuntimeEnvironment {
  param([Parameter(Mandatory)]$Context)
  $values = Read-LabEnvironment -Path $Context.RuntimeEnvFile
  if ($values.LAB_RUNTIME_MARKER -ne $script:LabMarker -or
      $values.LAB_POSTGRES_PORT -ne '55439' -or
      $values.WHATSAPP_PROVIDER -ne 'disabled' -or
      $values.AI_PROVIDER -ne 'disabled') {
    throw 'Runtime environment guardrails are invalid.'
  }
  return $values
}
