import { securityConfig } from '../config/security.js'

export async function verifyCaptchaOrThrow(token) {
  if (!securityConfig.captcha.enabled) {
    return true
  }
  if (!token) {
    throw new Error('Resolva o captcha para continuar.')
  }
  if (!securityConfig.captcha.verifyUrl) {
    throw new Error('Servico de verificacao do captcha nao configurado (VITE_HCAPTCHA_VERIFY_URL).')
  }

  const response = await fetch(securityConfig.captcha.verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  let payload = {}
  try {
    payload = await response.json()
  } catch (_) {
    payload = {}
  }

  if (!response.ok || payload.success === false) {
    const reason = payload?.reason || payload?.message || `Falha ao validar captcha (status ${response.status}).`
    throw new Error(reason)
  }

  return true
}
