# Executa a validacao do fator de tendencia e da auditoria do forecast em um PostgreSQL LOCAL e descartavel.
# Nao conecta no Supabase. Cria (ou recria) o banco informado em -Database.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File supabase/tests/forecast/run-local.ps1 -Port 5432
#
# Requisitos: PostgreSQL 15+ instalado localmente e um servidor aceitando conexoes em -Port.

param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$PgHost = 'localhost',
  [int]$Port = 5432,
  [string]$User = 'postgres',
  [string]$Database = 'forecast_test'
)

$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'
$psql = Join-Path $PgBin 'psql.exe'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')

# Migrations do forecast na ordem de producao; 05_ roda com a versao antiga e 10_ depois da 20261008.
$arquivos = @(
  'supabase\tests\validades\00_stub_supabase_local.sql',
  'supabase\tests\forecast\00_stub_forecast_local.sql',
  'supabase\migrations\20260423_add_forecast_audit_and_purchase_rpcs.sql',
  'supabase\migrations\20260423_fix_forecast_audit_purchase_security_definer.sql',
  'supabase\migrations\20260423_fix_forecast_snapshot_versioning.sql',
  'supabase\migrations\20260801_forecast_stats_metadata.sql',
  'supabase\migrations\20260926_secure_forecast_purchase_rpcs.sql',
  'supabase\tests\forecast\05_controle_versao_antiga.sql',
  'supabase\migrations\20261008_forecast_tendencia_e_auditoria.sql',
  'supabase\tests\forecast\10_forecast_auditoria_validacao.sql'
)

& $psql -h $PgHost -p $Port -U $User -d postgres -q -c "drop database if exists $Database;" -c "create database $Database;"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao recriar o banco de teste.' }

foreach ($arquivo in $arquivos) {
  $caminho = Join-Path $root $arquivo
  Write-Host "== $arquivo"
  # -o NUL descarta o resultado das consultas; os NOTICEs "ok - ..." continuam no console.
  & $psql -h $PgHost -p $Port -U $User -d $Database -v ON_ERROR_STOP=1 -q -o NUL -f $caminho
  if ($LASTEXITCODE -ne 0) { throw "Falha ao executar $arquivo" }
}

Write-Host 'Validacao concluida sem falhas.'
