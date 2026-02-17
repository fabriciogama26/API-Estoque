import express from 'express'
import cors from 'cors'
import env from './config/env.js'
import routes from './routes.js'
import { logApiError } from '../api/_shared/logger.js'
import {
  buildErrorEnvelope,
  ensureRequestId,
  logApiErrorNormalized,
  normalizeError,
} from '../api/_shared/errorCore.js'

const app = express()
const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 2000)

// Request ID para correlacionar logs
app.use((req, _res, next) => {
  ensureRequestId(req, _res)
  next()
})

// === CORS ===
const allowedOrigins = [
  'https://segtrab.com',       // frontend em produção (apex)
  'https://www.segtrab.com',   // frontend em produção (www)
  'https://proteg.vercel.app', // domínio legado no Vercel
  'http://localhost:5173'      // frontend em desenvolvimento (Vite)
];

app.use(cors({
  origin: function (origin, callback) {
    // Se não tiver origin (ex.: curl, Postman), permite
    if (!origin) return callback(null, true);
    // Se estiver na lista, permite
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Caso contrário, bloqueia
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Access log enxuto: só registra se for lento (>= limiar) para não encher o banco.
app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    const isSlow = durationMs >= SLOW_REQUEST_THRESHOLD_MS
    const isServerError = res.statusCode >= 500
    // Erros já são logados no middleware de erro; aqui só cuidamos de requisições lentas de sucesso.
    if (!isSlow || isServerError) {
      return
    }
    logApiError({
      message: 'Requisicao lenta',
      status: res.statusCode,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: req?.user?.id || null,
      context: { durationMs, requestId: req.requestId },
      severity: 'warn',
    }).catch(() => {})
  })
  next()
})

app.use('/api', routes);

app.use((req, res) => {
  const requestId = ensureRequestId(req, res)
  const normalized = normalizeError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'Recurso nao encontrado: Aguardando frontend',
  })
  res.status(normalized.status).json(buildErrorEnvelope(normalized, requestId))
})

app.use((err, req, res, next) => {
  const normalized = normalizeError(err, { fallbackMessage: 'Erro interno do servidor' })
  const requestId = ensureRequestId(req, res)

  if (!err?.status) {
    console.error(err)
  }

  // Loga no Supabase sem bloquear a resposta
  logApiErrorNormalized(normalized, req).catch(() => {})

  res.status(normalized.status).json(buildErrorEnvelope(normalized, requestId))
})

if (process.argv[1] === decodeURI(new URL(import.meta.url).pathname)) {
  app.listen(env.port, () => {
    console.log(`API Estoque ouvindo na porta ${env.port}`)
  })
}

export default app
