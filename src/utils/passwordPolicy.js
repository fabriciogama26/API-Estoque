import { securityConfig } from '../config/security.js'

const symbolRegex = /[^A-Za-z0-9]/

function hasMixedCase(value) {
  return /[a-z]/.test(value) && /[A-Z]/.test(value)
}

function hasNumber(value) {
  return /\d/.test(value)
}

function hasSymbol(value) {
  return symbolRegex.test(value)
}

function sanitizeCompareValue(value) {
  return (value || '').toLowerCase().trim()
}

export function evaluatePasswordPolicy(password, context = {}) {
  const { email, username } = context
  const minLength = context.minLength || securityConfig.password.minLength

  const errors = []
  const pwd = password || ''
  const lowerPwd = pwd.toLowerCase()

  if (!pwd || pwd.length < minLength) {
    errors.push(`A senha deve ter pelo menos ${minLength} caracteres.`)
  }
  if (securityConfig.password.requireUpper || securityConfig.password.requireLower) {
    if (!hasMixedCase(pwd)) {
      errors.push('Use letras maiusculas e minusculas.')
    }
  }
  if (securityConfig.password.requireNumber && !hasNumber(pwd)) {
    errors.push('Inclua pelo menos um numero.')
  }
  if (securityConfig.password.requireSymbol && !hasSymbol(pwd)) {
    errors.push('Inclua pelo menos um simbolo.')
  }

  const usernamePart = sanitizeCompareValue(username || email?.split?.('@')?.[0])
  if (usernamePart && lowerPwd.includes(usernamePart)) {
    errors.push('A senha nao pode conter o usuario/email.')
  }
  const emailValue = sanitizeCompareValue(email)
  if (emailValue && lowerPwd.includes(emailValue)) {
    errors.push('A senha nao pode conter o email.')
  }

  return { ok: errors.length === 0, errors }
}

async function sha1Hex(value) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SHA-1 indisponivel no ambiente atual.')
  }
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export async function checkPasswordPwned(password) {
  if (!securityConfig.password.checkPwned) {
    return { found: false }
  }
  const sha1 = await sha1Hex(password)
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
  if (!response.ok) {
    // Falha ao checar, preferimos nao bloquear o usuario
    return { found: false, error: `HIBP status ${response.status}` }
  }
  const body = await response.text()
  const hit = body.split('\n').some((line) => line.trim().toUpperCase().startsWith(suffix))
  return { found: hit }
}

