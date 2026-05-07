const config = require('../config');

function piAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="piSignage"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(header.split(' ')[1], 'base64').toString();
  const [username, password] = decoded.split(':');

  if (username === config.piAuth.username && password === config.piAuth.password) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="piSignage"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

module.exports = piAuth;
