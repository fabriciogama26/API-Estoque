const { MaterialService } = require('../services');
const { mapError, createHttpError } = require('./helpers');

function criar(req, res, next) {
  try {
    const material = MaterialService.criarMaterial(req.body);
    return res.status(201).json(material);
  } catch (error) {
    return next(mapError(error));
  }
}

function listar(req, res, next) {
  try {
    const materiais = MaterialService.listarMateriais();
    return res.json(materiais);
  } catch (error) {
    return next(error);
  }
}

function obter(req, res, next) {
  try {
    const material = MaterialService.obterMaterial(req.params.id);
    if (!material) {
      return next(createHttpError(404, 'Material nao encontrado'));
    }
    return res.json(material);
  } catch (error) {
    return next(error);
  }
}

function atualizar(req, res, next) {
  try {
    const material = MaterialService.atualizarMaterial(req.params.id, req.body);
    return res.json(material);
  } catch (error) {
    return next(mapError(error));
  }
}

function historicoPreco(req, res, next) {
  try {
    const historico = MaterialService.obterHistoricoPreco(req.params.id);
    return res.json(historico);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  criar,
  listar,
  obter,
  atualizar,
  historicoPreco
};



