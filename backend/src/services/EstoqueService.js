const repositories = require('../repositories');
const { estoqueRules } = require('../rules');

function filtrarPorPeriodo(registro, campoData, periodo) {
  if (!periodo) {
    return true;
  }

  const rawValue = registro[campoData];
  if (!rawValue) {
    return false;
  }

  const data = new Date(rawValue);
  if (Number.isNaN(data.getTime())) {
    return false;
  }

  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;

  if (periodo.inicio || periodo.fim) {
    const indice = ano * 12 + (mes - 1);

    if (periodo.inicio) {
      const inicioAno = Number(periodo.inicio.ano);
      const inicioMes = periodo.inicio.mes ? Number(periodo.inicio.mes) - 1 : 0;
      if (!Number.isNaN(inicioAno)) {
        const inicioIndice = inicioAno * 12 + inicioMes;
        if (indice < inicioIndice) {
          return false;
        }
      }
    }

    if (periodo.fim) {
      const fimAno = Number(periodo.fim.ano);
      const fimMes = periodo.fim.mes ? Number(periodo.fim.mes) - 1 : 11;
      if (!Number.isNaN(fimAno)) {
        const fimIndice = fimAno * 12 + fimMes;
        if (indice > fimIndice) {
          return false;
        }
      }
    }

    return true;
  }

  if (periodo.ano && ano !== Number(periodo.ano)) {
    return false;
  }

  if (periodo.mes && mes !== Number(periodo.mes)) {
    return false;
  }

  return true;
}

function agruparHistorico(lista, campoData) {
  const mapa = new Map();

  lista.forEach((item) => {
    const data = new Date(item[campoData]);
    if (Number.isNaN(data.getTime())) {
      return;
    }

    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() + 1;
    const key = `${ano}-${mes}`;

    const material = item.material || repositories.materiais.findById(item.materialId);
    const quantidade = Number(item.quantidade ?? 0);
    const valorUnitario = Number(material?.valorUnitario ?? 0);
    const valor = quantidade * valorUnitario;

    if (!mapa.has(key)) {
      mapa.set(key, {
        ano,
        mes,
        quantidade: 0,
        valorTotal: 0,
      });
    }

    const atual = mapa.get(key);
    atual.quantidade += quantidade;
    atual.valorTotal = Number((atual.valorTotal + valor).toFixed(2));
  });

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.ano !== b.ano) {
      return a.ano - b.ano;
    }
    return a.mes - b.mes;
  });
}

class EstoqueService {
  calcularSaldoMaterial(materialId, periodo) {
    const entradas = repositories.entradas
      .findByMaterial(materialId)
      .filter((entrada) => filtrarPorPeriodo(entrada, 'dataEntrada', periodo));

    const saidas = repositories.saidas
      .findByMaterial(materialId)
      .filter((saida) => filtrarPorPeriodo(saida, 'dataEntrega', periodo));

    const totalEntradas = entradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0);
    const totalSaidas = saidas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0);

    return totalEntradas - totalSaidas;
  }

  obterEstoqueAtual(periodo) {
    const materiais = repositories.materiais.findAll();
    const resultado = materiais.map((material) => {
      const saldo = this.calcularSaldoMaterial(material.id, periodo);
      const alerta = estoqueRules.verificarEstoqueMinimo(material, saldo);

      return {
        materialId: material.id,
        nome: material.nome,
        fabricante: material.fabricante,
        validadeDias: material.validadeDias,
        ca: material.ca,
        valorUnitario: material.valorUnitario,
        quantidade: saldo,
        estoqueAtual: saldo,
        valorTotal: Number((saldo * material.valorUnitario).toFixed(2)),
        estoqueMinimo: material.estoqueMinimo,
        alerta,
      };
    });

    const alertas = resultado.filter((item) => item.alerta);

    return {
      itens: resultado,
      alertas,
    };
  }

  validarDisponibilidade(materialId, quantidade) {
    const saldo = this.calcularSaldoMaterial(materialId);
    return saldo >= Number(quantidade);
  }

  obterDashboard(periodo) {
    const materiais = repositories.materiais.findAll();
    const entradas = repositories.entradas.findAll();
    const saidas = repositories.saidas.findAll();

    const filtro = (lista, campoData) => lista.filter((item) => filtrarPorPeriodo(item, campoData, periodo));

    const entradasFiltradas = filtro(entradas, 'dataEntrada');
    const saidasFiltradas = filtro(saidas, 'dataEntrega');

    const formatEntradaDetalhe = (entrada) => ({
      ...entrada,
      material: repositories.materiais.findById(entrada.materialId) || null,
    });

    const formatSaidaDetalhe = (saida) => ({
      ...saida,
      material: repositories.materiais.findById(saida.materialId) || null,
      pessoa: repositories.pessoas.findById(saida.pessoaId) || null,
    });

    const entradasDetalhadas = entradasFiltradas.map(formatEntradaDetalhe);
    const saidasDetalhadas = saidasFiltradas.map(formatSaidaDetalhe);

    const somaValores = (lista) => lista.reduce((acc, item) => {
      const material = repositories.materiais.findById(item.materialId);
      if (!material) {
        return acc;
      }
      const valor = Number(item.quantidade ?? 0) * Number(material.valorUnitario ?? 0);
      return acc + valor;
    }, 0);

    const somaQuantidade = (lista) => lista.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0);

    const totalEntradasValor = somaValores(entradasFiltradas);
    const totalSaidasValor = somaValores(saidasFiltradas);

    const movimentacaoPorMaterial = materiais.map((material) => {
      const entradasMaterial = entradasFiltradas.filter((item) => item.materialId === material.id);
      const saidasMaterial = saidasFiltradas.filter((item) => item.materialId === material.id);
      const totalQuantidade = entradasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
        + saidasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0);
      return {
        materialId: material.id,
        nome: material.nome,
        fabricante: material.fabricante,
        totalQuantidade,
      };
    });

    const maisMovimentados = movimentacaoPorMaterial
      .filter((item) => item.totalQuantidade > 0)
      .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
      .slice(0, 10);

    const estoqueAtual = this.obterEstoqueAtual(periodo);

    const entradasHistoricas = agruparHistorico(entradasDetalhadas, 'dataEntrada');
    const saidasHistoricas = agruparHistorico(saidasDetalhadas, 'dataEntrega');

    return {
      periodo: periodo || null,
      entradas: {
        quantidade: somaQuantidade(entradasFiltradas),
        valorTotal: Number(totalEntradasValor.toFixed(2)),
      },
      saidas: {
        quantidade: somaQuantidade(saidasFiltradas),
        valorTotal: Number(totalSaidasValor.toFixed(2)),
      },
      entradasDetalhadas,
      saidasDetalhadas,
      entradasHistoricas,
      saidasHistoricas,
      materiaisMaisMovimentados: maisMovimentados,
      estoqueAtual,
    };
  }
}

module.exports = new EstoqueService();
