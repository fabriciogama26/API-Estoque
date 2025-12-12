import { securityConfig } from '../config/security.js'
import { evaluatePasswordPolicy, checkPasswordPwned } from '../utils/passwordPolicy.js'

export async function validatePasswordOrThrow(password, context = {}) {
  const policy = evaluatePasswordPolicy(password, {
    ...context,
    minLength: context.minLength || securityConfig.password.minLength,
  })
  if (!policy.ok) {
    throw new Error(policy.errors.join(' '))
  }

  const leak = await checkPasswordPwned(password)
  if (leak.found) {
    throw new Error('Senha encontrada em bases vazadas. Escolha outra senha mais forte.')
  }
  return true
}

