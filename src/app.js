const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');

const app = express();

// === CORS ===
const allowedOrigins = [
  'https://proteg.vercel.app', // frontend em produção
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

app.use('/api', routes);

app.use((req, res, next) => {
  res.status(404).json({ error: 'Recurso nao encontrado: Aguardando frontend' });
});

app.use((err, req, res, next) => {
  if (!err.status) {
    console.error(err);
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno do servidor'
  });
});

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`API Estoque ouvindo na porta ${env.port}`);
  });
}

module.exports = app;
