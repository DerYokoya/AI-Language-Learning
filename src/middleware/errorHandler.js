module.exports = function errorHandler(err, req, res, next) {
  // Operational errors (AppError) — expected, safe to expose message
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unexpected bugs — log fully, hide internals from client
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
};