const { SaidaService } = require('../services');
const { mapError } = require('./helpers');

function criar(req, res, next) {
  try {
    const saida = SaidaService.registrarSaida(req.body);
    return res.status(201).json(saida);
  } catch (error) {
    return next(mapError(error));
  }
}

function listar(req, res, next) {
  try {
    const saidas = SaidaService.listarSaidas();
    return res.json(saidas);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  criar,
  listar
};



