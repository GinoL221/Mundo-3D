/**
 * Global error-handling middleware.
 * Must be registered as the LAST middleware in app.js.
 * Express identifies this as error middleware by the 4 parameters.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  const statusCode = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Algo salió mal. Intente nuevamente más tarde.'
      : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
