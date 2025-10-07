const { AuthService } = require('../services')
const { mapError } = require('./helpers')

function login(req, res, next) {
  try {
    const user = AuthService.autenticar({
      username: req.body?.username,
      password: req.body?.password,
    })

    return res.json({
      user,
    })
  } catch (error) {
    return next(mapError(error, error.status || 401))
  }
}

module.exports = {
  login,
}
