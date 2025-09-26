# Backend - API Estoque

API REST em Node.js 20 + Express voltada para a gestao de estoque de EPIs. O backend disponibiliza endpoints para cadastro de materiais e pessoas, registro de entradas e saidas, calculo de estoque atual e geracao de indicadores para dashboards.

## Visao geral
- Estrutura modular em camadas (controllers -> services -> repositories -> rules) que separa responsabilidades e facilita testes.
- Persistencia em memoria utilizando `Map`, encapsulada por repositories especializados (facilmente substituiveis por banco de dados).
- Validacoes de regras de negocio centralizadas em `src/rules`, evitando inconsistencias entre controllers e services.
- Servico de estoque consolida movimentacoes, gera alertas de estoque minimo e agrega dados historicos para graficos.
- Autenticacao basica via credenciais definidas em variaveis de ambiente.

## Requisitos
- Node.js 20 ou superior
- npm 10 ou superior

## Instalacao e execucao rapida
1. Instale dependencias no monorepo: `npm install`
2. Opcionalmente instale apenas no backend: `npm install` dentro da pasta `backend/`
3. Configure variaveis copiando `.env.example` para `.env`
4. Execute `npm run dev` na raiz ou `npm run dev` dentro de `backend/`
5. API disponivel em `http://localhost:3000/api`

## Scripts npm
- `npm run dev` - inicia o servidor com Nodemon.
- `npm run start` - executa em modo producao (Node).
- `npm run lint` - roda ESLint com as configuracoes padrao do projeto.

(Quando executados a partir da raiz, prefixe com `npm run <script> -w backend`.)

## Estrutura de pastas
```
backend/
|- package.json
|- .env.example
|- src/
   |- app.js             # Configuracao do Express e middlewares globais
   |- config/
   |  |- env.js         # Carrega variaveis de ambiente
   |- controllers/      # Adaptadores HTTP
   |- services/         # Regras de negocio e orquestracao
   |- repositories/     # Persistencia em memoria com Map
   |- models/           # Entidades de dominio (Material, Pessoa, etc.)
   |- routes/           # Definicao de rotas Express por recurso
   |- rules/            # Validacoes de negocio reutilizaveis
```

## Configuracao (.env)
```
PORT=3000
APP_USERNAME=admin
APP_PASSWORD=admin123
APP_DISPLAY_NAME=Administrador
```
- `PORT` define a porta do servidor HTTP.
- `APP_USERNAME`, `APP_PASSWORD` e `APP_DISPLAY_NAME` alimentam a autenticacao basica.

## Arquitetura e camadas
- **Controllers**: Recebem requests Express, chamam services e tratam respostas/erros padronizados.
- **Services**: Implementam regras de negocio: validacoes, transformacoes, integracao entre repositories e rules.
- **Repositories**: Fornecem operacoes CRUD em memoria utilizando `Map`. Cada entidade (materiais, pessoas, entradas, saidas, precos) possui repository proprio.
- **Rules**: Funcoes puras que validam dados obrigatorios, estoque minimo, disponibilidade, intervalo de datas e demais regras especificas.
- **Models**: Estruturas de dados padronizadas para materiais, pessoas, precos historicos, entradas e saidas.

## Persistencia e dados
- Os repositories armazenam dados em Map durante o ciclo de vida do processo.
- Historico de precos (`PrecoHistorico`) e registrado para toda alteracao de valor unitario.
- Estendivel para bancos relacionais ou NoSQL substituindo repositories por implementacoes persistentes.

## Endpoints principais
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/health` | Verificacao de disponibilidade da API |
| POST | `/api/auth/login` | Autenticacao basica usando variaveis de ambiente |
| GET | `/api/materiais` | Lista materiais cadastrados |
| POST | `/api/materiais` | Cria material com validacoes de CA, validade, fabricante e valor |
| GET | `/api/materiais/:id` | Recupera detalhes de um material |
| PUT | `/api/materiais/:id` | Atualiza material e registra historico de preco |
| GET | `/api/materiais/:id/historico-precos` | Retorna historico de valores |
| GET | `/api/pessoas` | Lista pessoas |
| POST | `/api/pessoas` | Cadastra pessoa |
| GET | `/api/pessoas/:id` | Detalhes de uma pessoa |
| GET | `/api/entradas` | Lista movimentacoes de entrada |
| POST | `/api/entradas` | Registra entrada de material |
| GET | `/api/saidas` | Lista movimentacoes de saida |
| POST | `/api/saidas` | Registra saida de material com bloqueio de estoque negativo |
| GET | `/api/estoque` | Resumo de estoque atual, aceita filtros de periodo |
| GET | `/api/estoque/dashboard` | Indicadores agregados para dashboards |

Parametros de periodo aceitam formatos `ano`, `mes` ou intervalo `periodoInicio=YYYY-MM` / `periodoFim=YYYY-MM`.

## Regras de negocio principais
1. Materiais nao podem ser duplicados por nome + fabricante.
2. Estoque minimo deve ser numero nao negativo; alertas sao gerados quando saldo fica abaixo.
3. Alteracao de valor unitario gera novo registro em historico de precos.
4. Entradas e saidas validam datas ISO e quantidades positivas.
5. Saidas sao bloqueadas quando nao ha saldo suficiente.
6. Saida calcula data de validade do EPI com base na validade do material.
7. Pessoas permitem nomes iguais, mas IDs sao unicos.

Mais detalhes de fluxos e validacoes estao na pasta `docs/` do monorepo.

## Tratamento de erros
- Erros de validacao lancados pelas rules recebem status apropriados via helper `mapError`.
- Erros inesperados geram resposta 500 com log no console (apenas em desenvolvimento).
- Respostas padrao retornam objetos `{ error: <mensagem> }`.

## Testes e qualidade
- No momento nao ha suite automatizada. Sugestoes:
  - Adicionar testes unitarios para rules e services.
  - Criar testes de integracao para os principais endpoints usando Supertest.
  - Configurar lint e hooks (ex.: Husky) para validar codigo antes de commits.

## Roadmap sugerido
- Substituir repositories em memoria por banco de dados com camada de persistencia dedicada.
- Implementar autenticacao com tokens (JWT) e refresh/expiracao.
- Adicionar operacoes de atualizacao/soft delete para pessoas e movimentacoes.
- Documentar API com OpenAPI/Swagger e gerar collections para testes.
- Criar seeds ou fixtures para popular dados em ambientes de QA.
- Implementar testes automatizados conforme secoes anteriores.
