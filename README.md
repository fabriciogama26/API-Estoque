# API-Estoque

Aplicacao React (Vite) para gestao de EPIs/Estoque integrada ao Supabase.

Documentacao detalhada por pagina em `docs/`.

## Requisitos

- Node.js 20+
- Projeto Supabase (Postgres + Auth + Storage)

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

## Variaveis de ambiente (frontend)

Crie `.env.local`:

- `VITE_SUPABASE_URL` (ex.: `https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL` (base das Edge Functions, ex.: `https://<project-ref>.supabase.co/functions/v1`)
- `VITE_IMPORTS_BUCKET` (opcional, padrao `imports`)

## Supabase (migrations)

As migrations ficam em `supabase/migrations/`.

Para aplicar no projeto remoto:

```bash
supabase db push
```

## Desligamento em massa (Pessoas)

Fluxo:
1) Usuario seleciona um arquivo XLSX no modal de Pessoas.
2) Front faz upload do XLSX no Storage (bucket `imports`) e chama a Edge Function `desligamento-import` passando `{ path }`.
3) A Edge Function baixa o arquivo, valida linhas, atualiza `public.pessoas`, registra `public.pessoas_historico` e remove o XLSX enviado (best-effort).

Arquivos e docs:
- UI: `src/components/Pessoas/PessoasDesligamentoModal.jsx`
- Service: `src/services/api.js` (`api.pessoas.importDesligamentoPlanilha`)
- Edge Functions: `supabase/functions/desligamento-import` e `supabase/functions/desligamento-template`
- Bucket/policies: `supabase/migrations/0077_fix_imports_bucket.sql`
- Documentacao do fluxo: `docs/DesligamentoEmMassa.txt`

