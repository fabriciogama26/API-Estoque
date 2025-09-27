const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  username: process.env.APP_USERNAME || 'admin',
  password: process.env.APP_PASSWORD || 'admin123',
  displayName: process.env.APP_DISPLAY_NAME || 'Administrador'
};
