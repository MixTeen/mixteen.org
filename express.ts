import * as express from 'express';
import * as logger from 'morgan';
import * as compression from 'compression';
import * as helmet from 'helmet';
import {CacheService} from "./cache.service";
import errorHandler = require("errorhandler");

export const IS_PROD: boolean = (process.env.NODE_ENV &&
  (process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production')) || false;

export interface ServerOptions {
  static: string;
  port: number;
}

export class Express {

  public app: express.Application;

  constructor(public options: ServerOptions) {


    //create expressjs application
    this.app = express();

    //configure application
    this.config();

    // 404 redirection
    this.app.all('*', (req, res, next) => req.url.indexOf(".html") ? res.redirect(`/404.html`) : next());


    this.app.set('port', this.options.port);
  }

  /**
   * Configure application
   */
  public config() {
    console.log('IS_PROD', IS_PROD || false)
    this.app
      .set('view engine', 'handlebars')
      .enable('view cache')
      .enable('trust proxy')
      .use(compression())
      .use(express.urlencoded({extended: false}))
      //.use(IS_PROD ? helmet() : helmet({ contentSecurityPolicy: false}))
      .use(helmet({contentSecurityPolicy: false}))
      .use(logger('dev'));

    this.app.use(express.static(this.options.static, {setHeaders: CacheService.create().setCustomCacheControl}));

    //error handling
    this.app.use(errorHandler());
  }

  /**
   * Bootstrap the application.
   */
  public static bootstrap(options: ServerOptions): Express {
    console.log("Try to start server");
    return new Express(options);
  }
}
