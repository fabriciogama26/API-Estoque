function mapError(error, status = 400) {
  if (error instanceof Error) {
    if (!error.status) {
      error.status = status;
    }
    return error;
  }

  const err = new Error(String(error));
  err.status = status;
  return err;
}

module.exports = {
  mapError
};



