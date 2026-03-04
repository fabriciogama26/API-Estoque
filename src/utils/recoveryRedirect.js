export function getRecoveryRedirect(location) {
  const search =
    typeof location?.search === 'string'
      ? location.search
      : typeof window !== 'undefined'
        ? window.location.search
        : ''
  const hash =
    typeof location?.hash === 'string'
      ? location.hash
      : typeof window !== 'undefined'
        ? window.location.hash
        : ''

  const searchParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const type = searchParams.get('type') || hashParams.get('type')

  if (type !== 'recovery') {
    return null
  }

  return `/reset-password${search || ''}${hash || ''}`
}
