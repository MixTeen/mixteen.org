const express = require('express');
const http = require('http');
const compression = require('compression');
const helmet = require('helmet');
const cachePolicy = require('./server/app.webcache');
const security = require('./server/app.security');

const MIXTEEN = {
  static: 'build/dist',
  port: process.env.PORT || 8082
};

const app = express()
  .enable('trust proxy')
  .use(security.rewrite())
  .use(compression())
  .use(express.urlencoded({extended: false}))
  .use(helmet())
  //.use(helmet.contentSecurityPolicy(security.securityPolicy()))
  .use(security.corsPolicy())
  .use(express.static(MIXTEEN.static, {setHeaders: cachePolicy.setCustomCacheControl}))
  .all('*', security.notFoundHandler());

app.set('port', MIXTEEN.port);

http.Server(app)
    .listen(MIXTEEN.port)
    .on('error', onError)
    .on('listening', () => {
      console.debug('Listening on ' + MIXTEEN.port);
      console.debug(`Environnement ${process.env.NODE_ENV}`);
    });

function onError(error) {
  console.error(error);
  if (error.syscall !== 'listen') {
    throw error;
  }
  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EADDRINUSE':
      console.error('Port is already in use : ' + MIXTEEN.port);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

