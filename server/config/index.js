const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mysignage',
  jwtSecret: process.env.JWT_SECRET || 'change-this',
  jwtExpiresIn: '7d',
  syncDir: path.resolve(__dirname, '..', process.env.SYNC_DIR || './data/sync_folders'),
  mediaDir: path.resolve(__dirname, '..', process.env.MEDIA_DIR || './data/media'),
  piAuth: {
    username: process.env.PI_AUTH_USER || 'pi',
    password: process.env.PI_AUTH_PASS || 'pi',
  },
};
