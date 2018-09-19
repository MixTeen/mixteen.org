'use strict';

const run = require('child_process').exec;

module.exports = function (gitbooks, callback) {

  if(!gitbooks){
    throw new PluginError('convert-gitbook', 'Missing gitbooks array');
  }
  if(!Array.isArray(gitbooks)){
    throw new PluginError('convert-gitbook', 'First arge must be an array');
  }


  gitbooks.forEach(project => {
    if(!project.src || !project.dist){
      throw new PluginError('convert-gitbook', 'For each book you have to send the src and the dist path');
    }
    run(`node ./node_modules/gitbook-cli/bin/gitbook build ${project.src} ${project.dist}`, function(error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }
    });
  });

  callback(null);
};
