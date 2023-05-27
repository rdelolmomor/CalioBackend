const cacheMiddleware = (sessionManager, io) => (req, res, next) => {
  req.sessionManager = sessionManager;
  req.io = io;
  res.reject = error => res.status(401).send({ error });
  res.error = error => res.status(500).send({ error });
  next();
};

module.exports = cacheMiddleware;
