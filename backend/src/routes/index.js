const express = require('express')
const authRoutes = require('./authRoutes')
const materialRoutes = require('./materialRoutes')
const pessoaRoutes = require('./pessoaRoutes')
const entradaRoutes = require('./entradaRoutes')
const saidaRoutes = require('./saidaRoutes')
const estoqueRoutes = require('./estoqueRoutes')

const router = express.Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

router.use('/auth', authRoutes)
router.use('/materiais', materialRoutes)
router.use('/pessoas', pessoaRoutes)
router.use('/entradas', entradaRoutes)
router.use('/saidas', saidaRoutes)
router.use('/estoque', estoqueRoutes)

module.exports = router
