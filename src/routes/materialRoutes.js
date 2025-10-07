const express = require('express');
const controller = require('../controllers/materialController');

const router = express.Router();

router.get('/', controller.listar);
router.post('/', controller.criar);
router.get('/:id', controller.obter);
router.put('/:id', controller.atualizar);
router.get('/:id/historico-precos', controller.historicoPreco);

module.exports = router;



