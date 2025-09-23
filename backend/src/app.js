const express = require('express');
const env = require('./config/env');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((req, res, next) => {
  res.status(404).json({ error: 'Recurso nao encontrado' });
});

app.use((err, req, res, next) => {
  if (!err.status) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno do servidor'
  });
});

if (require.main === module) {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API Estoque ouvindo na porta ${env.port}`);
  });
}

module.exports = app;

