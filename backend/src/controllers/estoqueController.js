const { EstoqueService } = require('../services');

function montarPeriodo(query) {
  const temIntervalo = Boolean(query.periodoInicio || query.periodoFim);

  if (temIntervalo) {
    const periodo = {};

    if (query.periodoInicio) {
      const [anoInicioRaw, mesInicioRaw] = String(query.periodoInicio).split('-');
      const anoInicio = Number(anoInicioRaw);
      const mesInicio = Number(mesInicioRaw);

      if (anoInicioRaw && !Number.isNaN(anoInicio)) {
        periodo.inicio = { ano: anoInicio };
        if (mesInicioRaw && !Number.isNaN(mesInicio)) {
          periodo.inicio.mes = mesInicio;
        }
      }
    }

    if (query.periodoFim) {
      const [anoFimRaw, mesFimRaw] = String(query.periodoFim).split('-');
      const anoFim = Number(anoFimRaw);
      const mesFim = Number(mesFimRaw);

      if (anoFimRaw && !Number.isNaN(anoFim)) {
        periodo.fim = { ano: anoFim };
        if (mesFimRaw && !Number.isNaN(mesFim)) {
          periodo.fim.mes = mesFim;
        }
      }
    }

    if (!periodo.inicio && periodo.fim) {
      periodo.inicio = { ...periodo.fim };
    }

    if (!periodo.fim && periodo.inicio) {
      periodo.fim = { ...periodo.inicio };
    }

    if (periodo.inicio || periodo.fim) {
      return periodo;
    }
  }

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
