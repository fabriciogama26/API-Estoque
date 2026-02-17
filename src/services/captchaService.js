import { securityConfig } from '../config/security.js'
import { ApiError, request as httpRequest } from './httpClient.js'

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

  let payload = {}
  try {
    payload = await httpRequest('POST', securityConfig.captcha.verifyUrl, {
      body: { token },
      headers: { 'Content-Type': 'application/json' },
      skipSessionGuard: true,
    })
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(err.message)
    }
    throw new Error(err?.message || 'Falha ao validar captcha.')
  }

  if (payload.success === false) {
    const reason = payload?.reason || payload?.message || 'Falha ao validar captcha.'
    throw new Error(reason)
  }

  return true
}
