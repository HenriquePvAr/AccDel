[CmdletBinding()]
param(
  [switch]$DryRun,
  [ValidateSet('127.0.0.1', '0.0.0.0')][string]$BindAddress = '127.0.0.1',
  [string]$PublicHost = '127.0.0.1'
)

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
$branch = Assert-LabBranch -Context $context
Assert-CleanLabWorktree -Context $context
if (-not (Test-PrivateLabHost -HostName $PublicHost)) {
  throw 'PublicHost must be loopback or an RFC1918 private IPv4 address.'
}
if ($BindAddress -eq '0.0.0.0' -and $PublicHost -in @('127.0.0.1', 'localhost')) {
  throw 'A private LAN PublicHost is required when binding user interfaces to 0.0.0.0.'
}
if (Test-Path -LiteralPath $context.ProcessFile) {
  throw 'An owned process document already exists. Run status-lab.ps1 or stop-lab.ps1.'
}
Assert-LabPortsFree

$requiredPaths = @(
  (Join-Path $context.Root 'node_modules\vite\bin\vite.js'),
  (Join-Path $context.Root 'apps\waiter-app\node_modules\vite\bin\vite.js'),
  (Join-Path $context.Root 'apps\print-agent\node_modules\typescript\package.json'),
  (Join-Path $context.Root 'apps\api\package-lock.json'),
  (Join-Path $context.Root 'scripts\lab\postgres-supervisor.mjs')
)
foreach ($path in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Required locked prerequisite is missing: $path" }
}

$sourceCommit = (& git -C $context.Root rev-parse HEAD).Trim()
if ($DryRun) {
  [pscustomobject]@{
    Branch = $branch
    SourceCommit = $sourceCommit
    BindAddress = $BindAddress
    PublicHost = $PublicHost
    API = 3333
    Admin = 4173
    Waiter = 4174
    PostgreSQL = 55439
    Printer = 'dry-run only'
    Runtime = '.pilot/lab (ignored)'
    ExternalProviders = 'disabled'
    SystemChanges = 'none'
  } | Format-List
  Write-Output 'Dry-run only: no file, process, port, firewall, driver or printer was changed.'
  return
}

$runtime = Assert-SafeLabPath -Path $context.Runtime -Context $context
[System.IO.Directory]::CreateDirectory($runtime) | Out-Null
[System.IO.Directory]::CreateDirectory($context.LogDirectory) | Out-Null

if (Test-Path -LiteralPath $context.OwnerFile) {
  $owner = Get-Content -Raw -LiteralPath $context.OwnerFile | ConvertFrom-Json
  if ($owner.marker -ne $script:LabMarker -or [string]$owner.projectRoot -ne $context.Root) {
    throw 'Existing laboratory runtime is not owned by this project.'
  }
  if ([string]$owner.sourceCommit -ne $sourceCommit) {
    throw 'Laboratory runtime belongs to another commit. Stop and reset before continuing.'
  }
} else {
  Write-LabJson -Path $context.OwnerFile -Value ([ordered]@{
    marker = $script:LabMarker
    projectRoot = $context.Root
    branch = $branch
    sourceCommit = $sourceCommit
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
  })
}

if (-not (Test-Path -LiteralPath $context.RuntimeEnvFile)) {
  $postgresPassword = New-LabSecret -ByteCount 24
  $jwtSecret = New-LabSecret -ByteCount 48
  $pilotPassword = 'Lab-' + (New-LabSecret -ByteCount 24)
  $agentToken = 'cpa_' + ([Guid]::NewGuid().ToString('N').Substring(0, 12)) + '_' + (New-LabSecret -ByteCount 32)
  $databaseUrl = "postgresql://cain_lab:$postgresPassword@127.0.0.1:55439/cain_lab_pilot?schema=public"
  $origins = @('http://127.0.0.1:4173', 'http://127.0.0.1:4174')
  if ($PublicHost -notin @('127.0.0.1', 'localhost')) {
    $origins += "http://${PublicHost}:4173", "http://${PublicHost}:4174"
  }
  $lines = @(
    "LAB_RUNTIME_MARKER=$script:LabMarker",
    "LAB_SOURCE_COMMIT=$sourceCommit",
    "LAB_BIND_ADDRESS=$BindAddress",
    "LAB_PUBLIC_HOST=$PublicHost",
    'LAB_API_PORT=3333',
    'LAB_ADMIN_PORT=4173',
    'LAB_WAITER_PORT=4174',
    'LAB_POSTGRES_PORT=55439',
    'POSTGRES_USER=cain_lab',
    'POSTGRES_DB=cain_lab_pilot',
    "POSTGRES_PASSWORD=$postgresPassword",
    "DATABASE_URL=$databaseUrl",
    "DIRECT_URL=$databaseUrl",
    "JWT_ACCESS_SECRET=$jwtSecret",
    "PILOT_USER_PASSWORD=$pilotPassword",
    "CAIN_PRINT_AGENT_TOKEN=$agentToken",
    'APP_ENV=staging',
    'NODE_ENV=production',
    'API_PORT=3333',
    'PUBLIC_WEB_URL=http://127.0.0.1:4173',
    "PUBLIC_API_URL=http://${PublicHost}:3333",
    "CORS_ALLOWED_ORIGINS=$($origins -join ',')",
    'JWT_ACCESS_EXPIRES_IN=8h',
    'EXPECTED_MIGRATION_COUNT=23',
    "SOURCE_COMMIT=$sourceCommit",
    'WHATSAPP_PROVIDER=disabled',
    'AI_PROVIDER=disabled',
    'MESSAGING_SANDBOX_MODE=true',
    'MESSAGING_ALLOWED_RECIPIENTS=',
    'FEATURE_WHATSAPP_ENABLED=false',
    'FEATURE_AI_ATTENDANT_ENABLED=false',
    'FEATURE_PRINTING_ENABLED=true',
    'FEATURE_WAITER_PWA_ENABLED=true',
    'FEATURE_PUBLIC_TRACKING_ENABLED=true',
    'FEATURE_ORDER_NOTIFICATIONS_ENABLED=false',
    'PUBLIC_TRACKING_TTL_MINUTES=1440',
    'OSRM_BASE_URL=http://127.0.0.1:9',
    'ALLOW_PILOT_SEED=true',
    "PILOT_CREDENTIALS_OUTPUT=$($context.SeedCredentials)",
    "LAB_RUNTIME_ROOT=$($context.Runtime)",
    "LAB_POSTGRES_DATA_DIR=$($context.PostgresData)",
    "LAB_POSTGRES_READY_FILE=$($context.PostgresReadyFile)",
    "LAB_POSTGRES_STOP_FILE=$($context.PostgresStopFile)"
  )
  Write-AtomicUtf8File -Path $context.RuntimeEnvFile -Content (($lines -join "`n") + "`n")
}

$runtimeValues = Get-LabRuntimeEnvironment -Context $context
if ($runtimeValues.LAB_SOURCE_COMMIT -ne $sourceCommit -or
    $runtimeValues.LAB_BIND_ADDRESS -ne $BindAddress -or
    $runtimeValues.LAB_PUBLIC_HOST -ne $PublicHost) {
  throw 'Runtime commit or network profile differs. Stop and reset before changing it.'
}

$apiSource = Join-Path $context.Root 'apps\api'
$sourceMarker = Join-Path $context.ApiRuntime 'lab-source-commit.txt'
if (-not (Test-Path -LiteralPath $sourceMarker)) {
  Assert-SafeLabPath -Path $context.ApiRuntime -Context $context | Out-Null
  [System.IO.Directory]::CreateDirectory($context.ApiRuntime) | Out-Null
  $copyArguments = @(
    $apiSource, $context.ApiRuntime, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
    '/XD', (Join-Path $apiSource 'node_modules'), (Join-Path $apiSource 'dist'), (Join-Path $apiSource '.embedded-postgres'),
    '/XF', (Join-Path $apiSource '.env'), '*.log'
  )
  & robocopy.exe @copyArguments | Out-Null
  $copyExit = $LASTEXITCODE
  if ($copyExit -gt 7) { throw "API runtime copy failed with robocopy code $copyExit." }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'postgres-supervisor.mjs') `
    -Destination (Join-Path $context.ApiRuntime 'lab-postgres-supervisor.mjs') -Force
  Write-AtomicUtf8File -Path $sourceMarker -Content "$sourceCommit`n"
} elseif ((Get-Content -Raw -LiteralPath $sourceMarker).Trim() -ne $sourceCommit) {
  throw 'API runtime source marker differs from the current commit.'
}

$lockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $context.ApiRuntime 'package-lock.json')).Hash.ToLowerInvariant()
$installMarker = Join-Path $context.ApiRuntime 'lab-install-lock.sha256'
$installedHash = if (Test-Path -LiteralPath $installMarker) { (Get-Content -Raw -LiteralPath $installMarker).Trim() } else { '' }
if ($installedHash -ne $lockHash -or
    -not (Test-Path -LiteralPath (Join-Path $context.ApiRuntime 'node_modules\embedded-postgres\package.json'))) {
  Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('ci') -WorkingDirectory $context.ApiRuntime
  Write-AtomicUtf8File -Path $installMarker -Content "$lockHash`n"
}

$apiEnvironment = @{}
foreach ($key in $runtimeValues.Keys) { $apiEnvironment[$key] = $runtimeValues[$key] }
$viteEnvironment = @{
  VITE_API_BASE_URL = "http://${PublicHost}:3333"
  VITE_DATA_SOURCE = 'api'
  VITE_STORE_ID = 'store_main'
}

Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'prisma:generate') -WorkingDirectory $context.ApiRuntime -Environment $apiEnvironment
Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'build') -WorkingDirectory $context.ApiRuntime -Environment $apiEnvironment
Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'build') -WorkingDirectory $context.Root -Environment $viteEnvironment
Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'build') -WorkingDirectory (Join-Path $context.Root 'apps\waiter-app') -Environment $viteEnvironment
Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'build') -WorkingDirectory (Join-Path $context.Root 'apps\print-agent')

$records = @()
try {
  Remove-Item -LiteralPath $context.PostgresReadyFile, $context.PostgresStopFile -Force -ErrorAction SilentlyContinue
  $supervisorScript = Join-Path $context.ApiRuntime 'lab-postgres-supervisor.mjs'
  $postgresSupervisor = Start-LabNodeProcess -Name 'postgres-supervisor' `
    -Arguments @($supervisorScript) -WorkingDirectory $context.ApiRuntime `
    -LogDirectory $context.LogDirectory -Environment $apiEnvironment -Port 0 `
    -CommandFragments @('lab-postgres-supervisor.mjs', $context.ApiRuntime)
  $postgresSupervisor.StopMode = 'postgres-supervisor'
  $records += $postgresSupervisor
  Write-LabProcessDocument -Context $context -Records $records

  Wait-LabPort -Port 55439 -State Listening -TimeoutSeconds 90
  if (-not (Test-Path -LiteralPath $context.PostgresReadyFile)) {
    throw 'PostgreSQL listener appeared without the supervisor readiness marker.'
  }
  $postgresListener = New-LabListenerRecord -Name 'postgres-listener' -Port 55439 `
    -CommandFragments @('postgres-data') -StopMode 'postgres-listener'
  $records += $postgresListener
  Write-LabProcessDocument -Context $context -Records $records

  Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'prisma:deploy') -WorkingDirectory $context.ApiRuntime -Environment $apiEnvironment
  Invoke-LabExternal -FilePath (Get-Command npm.cmd).Source -Arguments @('run', 'seed:pilot') -WorkingDirectory $context.ApiRuntime -Environment $apiEnvironment

  $apiScript = Join-Path $context.ApiRuntime 'dist\main.js'
  $apiRecord = Start-LabNodeProcess -Name 'api' -Arguments @($apiScript) `
    -WorkingDirectory $context.ApiRuntime -LogDirectory $context.LogDirectory `
    -Environment $apiEnvironment -Port 3333 -CommandFragments @($apiScript)
  $records += $apiRecord
  Write-LabProcessDocument -Context $context -Records $records
  Wait-LabPort -Port 3333 -State Listening -TimeoutSeconds 30

  $healthDeadline = [DateTime]::UtcNow.AddSeconds(30)
  do {
    try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3333/health' -TimeoutSec 2 } catch { $health = $null }
    if ($null -ne $health -and $health.status -eq 'ok') { break }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $healthDeadline)
  if ($null -eq $health -or $health.status -ne 'ok') { throw 'API health did not become ready.' }

  $adminVite = Join-Path $context.Root 'node_modules\vite\bin\vite.js'
  $adminRecord = Start-LabNodeProcess -Name 'admin' `
    -Arguments @($adminVite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort') `
    -WorkingDirectory $context.Root -LogDirectory $context.LogDirectory -Port 4173 `
    -CommandFragments @($adminVite, '--port 4173')
  $records += $adminRecord
  Write-LabProcessDocument -Context $context -Records $records

  $waiterRoot = Join-Path $context.Root 'apps\waiter-app'
  $waiterVite = Join-Path $waiterRoot 'node_modules\vite\bin\vite.js'
  $waiterRecord = Start-LabNodeProcess -Name 'waiter' `
    -Arguments @($waiterVite, 'preview', '--host', $BindAddress, '--port', '4174', '--strictPort') `
    -WorkingDirectory $waiterRoot -LogDirectory $context.LogDirectory -Port 4174 `
    -CommandFragments @($waiterVite, '--port 4174')
  $records += $waiterRecord
  Write-LabProcessDocument -Context $context -Records $records

  $printEnvironment = @{
    CAIN_API_BASE_URL = 'http://127.0.0.1:3333'
    CAIN_PRINT_AGENT_TOKEN = $runtimeValues.CAIN_PRINT_AGENT_TOKEN
    CAIN_PRINT_AGENT_NAME = 'Cain Lab Dry Run Agent'
    CAIN_PRINT_AGENT_VERSION = '0.1.0-lab'
    CAIN_PRINT_POLL_INTERVAL_MS = '500'
    CAIN_PRINT_HEARTBEAT_INTERVAL_MS = '5000'
    CAIN_PRINT_MAX_CONCURRENT_JOBS = '1'
    CAIN_PRINT_DRY_RUN = 'true'
    CAIN_PRINT_OUTPUT_DIR = (Join-Path $context.PrintData 'print-output')
    CAIN_PRINT_DATA_DIR = $context.PrintData
    CAIN_PRINT_LOG_LEVEL = 'info'
    CAIN_PRINT_HTTP_TIMEOUT_MS = '5000'
    CAIN_PRINT_TCP_TIMEOUT_MS = '2000'
    CAIN_PRINT_DRY_RUN_RETENTION_HOURS = '24'
  }
  $printRoot = Join-Path $context.Root 'apps\print-agent'
  $printScript = Join-Path $printRoot 'dist\src\main.js'
  $printRecord = Start-LabNodeProcess -Name 'print-agent' -Arguments @($printScript) `
    -WorkingDirectory $printRoot -LogDirectory $context.LogDirectory `
    -Environment $printEnvironment -Port 0 -CommandFragments @($printScript)
  $records += $printRecord
  Write-LabProcessDocument -Context $context -Records $records

  Wait-LabPort -Port 4173 -State Listening -TimeoutSeconds 30
  Wait-LabPort -Port 4174 -State Listening -TimeoutSeconds 30
  Start-Sleep -Seconds 2
  foreach ($record in $records) {
    $test = Test-LabProcessRecord -Record $record
    if (-not $test.Owned) { throw "Final startup ownership check failed for $($record.Name)." }
  }

  Write-Output 'Cain laboratory started with generated ignored credentials and fictitious data.'
  Write-Output 'Admin: http://127.0.0.1:4173 (computer only)'
  Write-Output "Waiter: http://${PublicHost}:4174"
  Write-Output "API: http://${PublicHost}:3333"
  Write-Output 'Print Agent: dry-run only; physical printing remains blocked.'
} catch {
  $failure = $_
  if (Test-Path -LiteralPath $context.ProcessFile) {
    try { & (Join-Path $PSScriptRoot 'stop-lab.ps1') -InternalCleanup } catch {
      Write-Warning 'Automatic owned-process cleanup could not complete; inspect status-lab.ps1.'
    }
  }
  throw $failure
}
