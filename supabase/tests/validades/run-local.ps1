# Executa a validacao do Controle de Validades em um PostgreSQL LOCAL e descartavel.
# Nao conecta no Supabase. Cria (ou recria) o banco informado em -Database.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File supabase/tests/validades/run-local.ps1 -Port 55432
#
# Requisitos: PostgreSQL 15+ instalado localmente e um servidor aceitando conexoes em -Port.

param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$PgHost = 'localhost',
  [int]$Port = 5432,
  [string]$User = 'postgres',
  [string]$Database = 'validades_test'
)

$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'
$psql = Join-Path $PgBin 'psql.exe'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')

$arquivos = @(
  'supabase\tests\validades\00_stub_supabase_local.sql',
  'supabase\migrations\20260929_01_validades_schema.sql',
  'supabase\migrations\20260929_02_validades_rpcs.sql',
  'supabase\migrations\20260929_03_validades_alertas.sql',
  'supabase\tests\validades\10_validades_validacao.sql'
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
