const express = require('express');
const controller = require('../controllers/estoqueController');

const router = express.Router();

router.get('/', (req, res, next) => {
  if (String(req.query.view).toLowerCase() === 'dashboard') {
    return controller.dashboard(req, res, next);
  }
  return controller.estoqueAtual(req, res, next);
});

module.exports = router;
