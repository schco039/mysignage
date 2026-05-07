const multer = require('multer');
const path = require('path');
const config = require('../config');

function sanitizeFilename(name) {
  return name
    .normalize('NFC')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.mediaDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const sanitized = sanitizeFilename(base) + ext.toLowerCase();
    // Add timestamp to avoid collisions
    const unique = `${Date.now()}-${sanitized}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
  },
});

module.exports = upload;
