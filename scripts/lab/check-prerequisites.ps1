[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'Lab.Common.ps1')

$context = Get-LabContext
$branch = Assert-LabBranch -Context $context
Assert-CleanLabWorktree -Context $context
Assert-LabPortsFree

$checks = New-Object System.Collections.Generic.List[object]
function Add-Check([string]$Name, [bool]$Ok, [string]$Detail) {
  $checks.Add([pscustomobject]@{ Check = $Name; Ok = $Ok; Detail = $Detail })
}

$nodeVersion = (& node.exe --version 2>$null)
$npmVersion = (& npm.cmd --version 2>$null)
$gitVersion = (& git --version 2>$null)
Add-Check 'branch' ($branch -eq $script:LabBranch) $branch
Add-Check 'node' ($nodeVersion -eq 'v24.16.0') $nodeVersion
Add-Check 'npm' ($npmVersion -eq '11.13.0') $npmVersion
Add-Check 'git' ([bool]$gitVersion) $gitVersion
Add-Check 'root dependencies' (Test-Path -LiteralPath (Join-Path $context.Root 'node_modules\vite\bin\vite.js')) 'locked root install present'
Add-Check 'waiter dependencies' (Test-Path -LiteralPath (Join-Path $context.Root 'apps\waiter-app\node_modules\vite\bin\vite.js')) 'locked waiter install present'
Add-Check 'print dependencies' (Test-Path -LiteralPath (Join-Path $context.Root 'apps\print-agent\node_modules\typescript\package.json')) 'locked print install present'
Add-Check 'API lockfile' (Test-Path -LiteralPath (Join-Path $context.Root 'apps\api\package-lock.json')) 'runtime copy will use npm ci'

$volume = Get-Volume -DriveLetter ([System.IO.Path]::GetPathRoot($context.Root).Substring(0, 1)) -ErrorAction Stop
$freeGiB = [Math]::Round($volume.SizeRemaining / 1GB, 1)
Add-Check 'disk space' ($freeGiB -ge 10) "$freeGiB GiB free"

$profiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
$privateActive = @($profiles | Where-Object { $_.NetworkCategory -eq 'Private' -and $_.IPv4Connectivity -ne 'Disconnected' }).Count -gt 0
Add-Check 'private network' $privateActive 'required only for later supervised phone access'

$printerCount = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'Microsoft|OneNote|Fax' }).Count
Add-Check 'thermal printer' $false "$printerCount non-virtual candidate(s); physical printing remains blocked"

$checks | Format-Table -AutoSize
$blocking = @($checks | Where-Object { -not $_.Ok -and $_.Check -ne 'thermal printer' }).Count
if ($blocking -gt 0) { throw "$blocking blocking prerequisite check(s) failed." }
Write-Output 'Prerequisites accepted for loopback dry-run. No system setting was changed.'
