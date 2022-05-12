'use strict';

import * as process from 'child_process'
import * as PluginError from 'plugin-error';

export interface GitBookConfig {
  src: string,
  dist: string
}

export function convertToGitBook(configs: Array<GitBookConfig>, callback) {
  if (!configs) {
    throw new PluginError('convert-gitbook', 'Missing gitbooks array');
  }
  if (!Array.isArray(configs)) {
    throw new PluginError('convert-gitbook', 'First arge must be an array');
  }

  configs.forEach(project => {
    if (!project.src || !project.dist) {
      throw new PluginError('convert-gitbook', 'For each book you have to send the src and the dist path');
    }
    process.exec(`node ./node_modules/gitbook-cli/bin/gitbook build ${project.src} ${project.dist}`, function (error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }
    });
  });

  callback(null);
}
