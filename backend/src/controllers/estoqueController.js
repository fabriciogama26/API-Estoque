const { EstoqueService } = require('../services');

function montarPeriodo(query) {
  const periodo = {};
  if (query.ano) {
    periodo.ano = Number(query.ano);
  }
  if (query.mes) {
    periodo.mes = Number(query.mes);
  }
  if (Object.keys(periodo).length === 0) {
    return null;
  }
  return periodo;
}

function estoqueAtual(req, res, next) {
  try {
    const periodo = montarPeriodo(req.query);
    const estoque = EstoqueService.obterEstoqueAtual(periodo);
    return res.json(estoque);
  } catch (error) {
    return next(error);
  }
}

function dashboard(req, res, next) {
  try {
    const periodo = montarPeriodo(req.query);
    const dados = EstoqueService.obterDashboard(periodo);
    return res.json(dados);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  estoqueAtual,
  dashboard
};



