const express = require('express');
const controller = require('../controllers/estoqueController');

const router = express.Router();

router.get('/', controller.estoqueAtual);
router.get('/dashboard', controller.dashboard);

module.exports = router;



