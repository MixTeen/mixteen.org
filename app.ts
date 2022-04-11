import * as http from 'http';
import {Express, ServerOptions} from "./express";

const options = {
  static: process.env.DEVMIND_SITE_PATH || `build/dist`,
  port: process.env.PORT || 8080,
} as ServerOptions;

const server = Express.bootstrap(options).app;
http.createServer(server)

  //listen on provided ports
  .listen(options.port)

  //add error handler
  .on("error", (error: any) => {
    if (error.syscall !== "listen") {
      throw error;
    }
    switch (error.code) {
      case "EACCES":
        console.error(`${options.port} requires elevated privileges`);
        process.exit(1);
        break;
      case "EADDRINUSE":
        console.error(`${options.port} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  })

  //start listening on port
  .on("listening", () => {
    console.debug('Listening on ' + options.port);
    console.debug(`Environnement ${process.env.NODE_ENV}`);
  });

