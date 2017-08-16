'use strict'

const map = require('map-stream')
const fs = require('fs');
const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const firebaseConfig = require("../../firebase.json");
const moment = require('moment');

module.exports = function (modedev) {

  const pageMetadata = {
    '404.html' : {
      keywords: 'MixTeen 404',
      title: 'MixTeen 404',
      description : 'Page non trouvée sur le serveur',
    },
    'index.html' : {
      keywords: 'MixTeen born to code',
      title: 'MixTeen',
      description : 'Apprendre un peu de ce monde numérique qui nous entoure c\'est important. Avec MixTeen, nous faisons découvrir aux enfants ce petit monde fabuleux !',
    },
    'events.html' : {
      keywords: 'Events MixTeen',
      title: 'Les events MixTeen',
      description : 'Vous voulez inscrire vos enfants à un de nos événements. Voici la liste de ceux qui arrivent et ceux qui ont déjà eu lieu',
      events: true
    }
  };

  return map((file, next) => {

    const html = fs.readFileSync(file.path, 'utf8');
    file.fileName = file.path.substring(file.path.lastIndexOf('/') + 1, file.path.length);

    if (!pageMetadata[file.fileName]) throw new PluginError('html-read', `Missing index definition for ${file.path} in the build script html-read`);

    file.templateModel = {
      keywords: () => pageMetadata[file.fileName].keywords,
      title: () => pageMetadata[file.fileName].title,
      description: () => pageMetadata[file.fileName].description,
      contents: () => new Buffer(html),
      gendate: () => moment().format('DD/mm/YYYY'),
      events: () => pageMetadata[file.fileName].events,
      firebaseApiKey: () => firebaseConfig.apiKey,
      canonicalUrl: () => file.fileName,
      modedev: () => modedev
    };

    next(null, file);
  });
}

