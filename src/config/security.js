const bool = (value) => `${value}`.toLowerCase() === 'true'

export const securityConfig = {
  password: {
    minLength: Number(import.meta.env.VITE_PASSWORD_MIN_LENGTH || 12) || 12,
    requireUpper: true,
    requireLower: true,
    requireNumber: true,
    requireSymbol: true,
    checkPwned: bool(import.meta.env.VITE_PASSWORD_CHECK_PWNED ?? 'true'),
  },
  captcha: {
    enabled: bool(import.meta.env.VITE_HCAPTCHA_ENABLED ?? 'false'),
    siteKey: import.meta.env.VITE_HCAPTCHA_SITEKEY || '',
    verifyUrl: import.meta.env.VITE_HCAPTCHA_VERIFY_URL || '',
    requiredFlows: {
      passwordRecovery: bool(import.meta.env.VITE_HCAPTCHA_REQUIRED_RECOVERY ?? 'true'),
    },
  },
}

