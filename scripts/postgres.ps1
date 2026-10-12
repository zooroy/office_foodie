param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $projectRoot '.local\pgsql\bin'
$pgData = Join-Path $projectRoot '.local\pgdata'
$pgLog = Join-Path $projectRoot '.local\postgres.log'

if (!(Test-Path -LiteralPath (Join-Path $pgBin 'pg_ctl.exe'))) {
    throw 'PostgreSQL binaries are missing from .local\pgsql.'
}
if (!(Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
    throw 'The local PostgreSQL cluster has not been initialized.'
}

switch ($Action) {
    'start' {
        & (Join-Path $pgBin 'pg_ctl.exe') status -D $pgData *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Output 'PostgreSQL is already running at 127.0.0.1:5432.'
        } else {
            $pgProcess = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -ArgumentList @('start', '-D', ('"' + $pgData + '"'), '-l', ('"' + $pgLog + '"'), '-w') -WindowStyle Hidden -PassThru
            $pgProcess.WaitForExit()
            if ($pgProcess.ExitCode -ne 0) { throw "PostgreSQL did not start. Check $pgLog" }
            Write-Output 'PostgreSQL started at 127.0.0.1:5432.'
        }
    }
    'stop' {
        & (Join-Path $pgBin 'pg_ctl.exe') stop -D $pgData -m fast -w
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not be stopped.' }
    }
    'status' {
        & (Join-Path $pgBin 'pg_ctl.exe') status -D $pgData
        exit $LASTEXITCODE
    }
}
