const SESSION_COOKIE_NAME =
  (process.env.SESSION_COOKIE_NAME || 'api-estoque-session').trim()

const SESSION_COOKIE_SAMESITE =
  (process.env.SESSION_COOKIE_SAMESITE || 'Lax').trim()

const resolveSecureFlag = () => {
  if (process.env.SESSION_COOKIE_SECURE !== undefined) {
    const raw = String(process.env.SESSION_COOKIE_SECURE).trim().toLowerCase()
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'
  }
  const env =
    (process.env.APP_ENV || process.env.NODE_ENV || process.env.VERCEL_ENV || '')
      .trim()
      .toLowerCase()
  return env === 'production'
}

const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000

const resolveMaxAgeMs = () => {
  const cookieRaw = process.env.SESSION_COOKIE_MAX_AGE_MS
  if (cookieRaw !== undefined && cookieRaw !== null && cookieRaw !== '') {
    const parsed = Number(cookieRaw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_MS
  }
  const timeboxRaw = process.env.SESSION_TIMEBOX_MS
  if (timeboxRaw !== undefined && timeboxRaw !== null && timeboxRaw !== '') {
    const parsed = Number(timeboxRaw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_MS
  }
  return DEFAULT_MAX_AGE_MS
}

const encodeValue = (value) =>
  encodeURIComponent(String(value ?? '').trim())

export function parseCookies(req) {
  const header =
    req?.headers?.cookie ||
    req?.headers?.Cookie ||
    req?.headers?.get?.('cookie') ||
    ''
  if (!header) {
    return {}
  }
  return header.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.split('=')
    const key = rawKey ? rawKey.trim() : ''
    if (!key) return acc
    acc[key] = decodeURIComponent(rest.join('=').trim())
    return acc
  }, {})
}

export function getSessionIdFromCookies(req) {
  const cookies = parseCookies(req)
  const value = cookies[SESSION_COOKIE_NAME]
  return value ? String(value).trim() : null
}

export function buildSessionCookie(sessionId, options = {}) {
  const maxAgeMs = options.maxAgeMs ?? resolveMaxAgeMs()
  const maxAgeSec = Math.max(Math.floor(maxAgeMs / 1000), 0)
  const secure = options.secure ?? resolveSecureFlag()
  const sameSite = options.sameSite || SESSION_COOKIE_SAMESITE
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeValue(sessionId)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSec}`,
  ]
  if (secure) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

export function buildClearSessionCookie(options = {}) {
  const secure = options.secure ?? resolveSecureFlag()
  const sameSite = options.sameSite || SESSION_COOKIE_SAMESITE
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0',
  ]
  if (secure) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

export function appendSetCookie(res, cookieValue) {
  if (!res || !cookieValue) return
  const existing = res.getHeader?.('Set-Cookie')
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue)
    return
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue])
    return
  }
  res.setHeader('Set-Cookie', [existing, cookieValue])
}

export const SESSION_COOKIE = {
  name: SESSION_COOKIE_NAME,
  maxAgeMs: resolveMaxAgeMs,
  isSecure: resolveSecureFlag,
}
