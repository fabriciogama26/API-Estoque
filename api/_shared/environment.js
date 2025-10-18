const RAW_DATA_MODE = (process.env.DATA_MODE || '').trim().toLowerCase()

export const CONSUME_LOCAL_DATA = RAW_DATA_MODE === 'local'
