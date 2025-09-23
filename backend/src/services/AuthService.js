class AuthService {
  constructor() {
    this.username = process.env.APP_USERNAME || 'admin'
    this.password = process.env.APP_PASSWORD || 'admin123'
    this.displayName = process.env.APP_DISPLAY_NAME || 'Administrador'
  }

  autenticar({ username, password }) {
    if (!username || !password) {
      const error = new Error('Credenciais obrigatorias')
      error.status = 400
      throw error
    }

    if (username !== this.username || password !== this.password) {
      const error = new Error('Usuario ou senha invalidos')
      error.status = 401
      throw error
    }

    return {
      username: this.username,
      name: this.displayName,
    }
  }
}

module.exports = new AuthService()
