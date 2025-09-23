const express = require('express');
const controller = require('../controllers/entradaController');

const router = express.Router();

router.get('/', controller.listar);
router.post('/', controller.criar);

module.exports = router;



