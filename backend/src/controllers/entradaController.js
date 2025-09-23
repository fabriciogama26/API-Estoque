const { EntradaService } = require('../services');
const { mapError } = require('./helpers');

function criar(req, res, next) {
  try {
    const entrada = EntradaService.registrarEntrada(req.body);
    return res.status(201).json(entrada);
  } catch (error) {
    return next(mapError(error));
  }
}

function listar(req, res, next) {
  try {
    const entradas = EntradaService.listarEntradas();
    return res.json(entradas);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  criar,
  listar
};



