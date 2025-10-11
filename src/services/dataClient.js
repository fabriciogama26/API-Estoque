import { isLocalMode } from '../config/runtime.js'
import { api } from './api.js'
import { localApi } from './localApi.js'

export const dataClient = isLocalMode ? localApi : api
