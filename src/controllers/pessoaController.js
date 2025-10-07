const { PessoaService } = require('../services')
const { mapError } = require('./helpers')

function criar(req, res, next) {
  try {
    const pessoa = PessoaService.criarPessoa(req.body)
    return res.status(201).json(pessoa)
  } catch (error) {
    return next(mapError(error))
  }
}

function listar(req, res, next) {
  try {
    if (req.query.nome) {
      const pessoas = PessoaService.buscarPorNome(req.query.nome)
      return res.json(pessoas)
    }

    const pessoas = PessoaService.listarPessoas()
    return res.json(pessoas)
  } catch (error) {
    return next(error)
  }
}

function obter(req, res, next) {
  try {
    const pessoa = PessoaService.buscarPorId(req.params.id)
    if (!pessoa) {
      return res.status(404).json({ error: 'Pessoa nao encontrada' })
    }
    return res.json(pessoa)
  } catch (error) {
    return next(error)
  }
}

function atualizar(req, res, next) {
  try {
    const pessoa = PessoaService.atualizarPessoa(req.params.id, req.body)
    return res.json(pessoa)
  } catch (error) {
    return next(mapError(error))
  }
}

function historico(req, res, next) {
  try {
    const registros = PessoaService.obterHistoricoEdicao(req.params.id)
    return res.json(registros)
  } catch (error) {
    return next(mapError(error))
  }
}

module.exports = {
  criar,
  listar,
  obter,
  atualizar,
  historico,
}
