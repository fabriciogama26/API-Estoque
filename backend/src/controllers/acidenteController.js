const { AcidenteService } = require('../services');
const { mapError } = require('./helpers');

function listar(req, res, next) {
  try {
    const acidentes = AcidenteService.listarAcidentes();
    return res.json(acidentes);
  } catch (error) {
    return next(error);
  }
}

function criar(req, res, next) {
  try {
    const acidente = AcidenteService.criarAcidente(req.body);
    return res.status(201).json(acidente);
  } catch (error) {
    return next(mapError(error));
  }
}

function atualizar(req, res, next) {
  try {
    const acidente = AcidenteService.atualizarAcidente(req.params.id, req.body);
    return res.json(acidente);
  } catch (error) {
    return next(mapError(error));
  }
}

module.exports = {
  listar,
  criar,
  atualizar
};
