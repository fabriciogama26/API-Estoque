const STATUS_CODE_MAP = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_REQUIRED',
  403: 'RLS_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMIT',
  502: 'UPSTREAM_ERROR',
  503: 'UPSTREAM_ERROR',
}

const resolveCodeFromStatus = (status) => {
  if (STATUS_CODE_MAP[status]) {
    return STATUS_CODE_MAP[status]
  }
  if (status >= 400 && status < 500) {
    return 'VALIDATION_ERROR'
  }
  if (status >= 500) {
    return 'INTERNAL'
  }
  return 'INTERNAL'
}

function createHttpError(status, message, code) {
  const err = new Error(message)
  err.status = status
  err.code = code || resolveCodeFromStatus(status)
  return err
}

function mapError(error, status = 400, code = null) {
  if (error instanceof Error) {
    if (!error.status) {
      error.status = status
    }
    if (!error.code) {
      error.code = code || resolveCodeFromStatus(error.status || status)
    }
    return error
  }

  const err = new Error(String(error))
  err.status = status
  err.code = code || resolveCodeFromStatus(status)
  return err
}

module.exports = {
  mapError,
  createHttpError,
}



