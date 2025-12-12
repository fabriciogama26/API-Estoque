import HCaptcha from '@hcaptcha/react-hcaptcha'
import { useCallback } from 'react'
import { securityConfig } from '../config/security.js'

export function CaptchaGuard({ onToken, disabled }) {
  const handleVerify = useCallback(
    (token) => {
      onToken?.(token || '')
    },
    [onToken]
  )

  const handleExpire = useCallback(() => {
    onToken?.('')
  }, [onToken])

  if (!securityConfig.captcha.enabled || !securityConfig.captcha.siteKey) {
    return null
  }

  return (
    <div className="captcha-guard">
      <HCaptcha
        sitekey={securityConfig.captcha.siteKey}
        onVerify={handleVerify}
        onExpire={handleExpire}
        onError={handleExpire}
        size="normal"
        theme="dark"
        disabled={disabled}
      />
    </div>
  )
}
