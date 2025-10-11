const RAW_DATA_MODE = (import.meta.env.VITE_DATA_MODE || 'remote').trim().toLowerCase()

export const dataMode = RAW_DATA_MODE === 'local' ? 'local' : 'remote'
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
