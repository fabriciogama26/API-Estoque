const RAW_DATA_MODE = (import.meta.env.VITE_DATA_MODE || 'remote').trim().toLowerCase()
const IS_DEV = Boolean(import.meta.env.DEV)

// Local mode só existe em ambiente de desenvolvimento.
export const dataMode = RAW_DATA_MODE === 'local' && IS_DEV ? 'local' : 'remote'
export const isLocalMode = dataMode === 'local'
export const isRemoteMode = !isLocalMode

export const LOCAL_DATA_STORAGE_KEY = 'api-estoque-local-data-v1'

export function describeDataMode() {
  return {
    mode: dataMode,
    local: isLocalMode,
    remote: isRemoteMode,
  }
}
