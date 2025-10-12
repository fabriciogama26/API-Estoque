const express = require('express')
const controller = require('../controllers/pessoaController')

const router = express.Router()

router.get('/', controller.listar)
router.post('/', controller.criar)
router.get('/:id', controller.obter)
router.put('/:id', controller.atualizar)
router.get('/history/:id', controller.historico)

module.exports = router
