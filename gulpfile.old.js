'use strict';

const gulp = require('gulp');
const del = require('del');
const path = require('path');
const browserSync = require('browser-sync').create();
const imagemin = require('gulp-imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const runSequence = require('run-sequence');
const wbBuild = require('workbox-build');

const $ = require('gulp-load-plugins')();

const asciidoctorRead = require('./gulp-extensions/transformers/asciidoctor-read');
const asciidoctorConvert = require('./gulp-extensions/transformers/asciidoctor-convert');
const asciidoctorIndexing = require('./gulp-extensions/transformers/asciidoctor-indexing');
const htmlRead = require('./gulp-extensions/transformers/html-read');
const applyTemplate = require('./gulp-extensions/transformers/apply-template');
const highlightCode = require('./gulp-extensions/transformers/highlight-code');
const firebaseImgCacheBusting = require('./gulp-extensions/transformers/firebase-img-cache-busting');

const AUTOPREFIXER_BROWSERS = [
  'ie >= 11',
  'ie_mob >= 11',
  'ff >= 45',
  'chrome >= 45',
  'safari >= 7',
  'opera >= 23',
  'ios >= 9',
  'android >= 4.4',
  'bb >= 10'
];

const HTMLMIN_OPTIONS = {
  removeComments: true,
  collapseWhitespace: true,
  collapseBooleanAttributes: true,
  removeAttributeQuotes: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  removeOptionalTags: true,
  minifyCSS: true
};

let modeDev = false;

gulp.task('styles', (cb) => {
  gulp.src(['src/sass/main.scss', 'src/sass/events.scss', 'src/sass/event-detail.scss'])
    .pipe($.newer('build/.tmp/css'))
    .pipe($.sourcemaps.init())
    .pipe($.sass({
      precision: 10
    }).on('error', $.sass.logError))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('build/.tmp/css'))
    // Concatenate and minify styles
    .pipe($.if('*.css', $.cssnano()))
    .pipe($.size({title: 'styles'}))
    .pipe($.if(!modeDev, $.rev()))
    .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest('build/dist/css'))
    .pipe($.if(!modeDev, $.rev.manifest()))
    .pipe(gulp.dest('build/dist/css'))
    .on('end', () => cb())
});

gulp.task('events-indexing', (cb) => {
  // Hack to be able to stop the task when the async firebase requests are complete
  gulp.on('stop', () => {
    if (!modeDev) {
      process.nextTick(() => process.exit(0));
    }
  });
  gulp.src('src/events/**/*.adoc')
    .pipe(asciidoctorRead(modeDev))
    .pipe(asciidoctorConvert())
    .pipe(asciidoctorIndexing(modeDev))
    .on('end', () => cb())
});


gulp.task('events', ['events-indexing'], (cb) => {
  gulp.src('src/events/**/*.adoc')
    .pipe(asciidoctorRead(modeDev))
    .pipe(asciidoctorConvert())
    .pipe(applyTemplate('src/templates/event-detail.hbs'))
    .pipe(highlightCode({selector: 'pre.highlight code'}))
    .pipe(gulp.dest('build/.tmp/events'))
    .pipe($.htmlmin(HTMLMIN_OPTIONS))
    .pipe(gulp.dest('build/dist/events'))
    .on('end', () => cb())
});

gulp.task('lint', () =>
  gulp.src('src/js/**/*.js')
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failOnError()))
);

gulp.task('html', () =>
  gulp
    .src('src/partials/**/*.html')
    .pipe(htmlRead(modeDev))
    .pipe(applyTemplate('src/templates/site.hbs'))
    .pipe($.size({title: 'html', showFiles: true}))
    .pipe(gulp.dest('build/.tmp'))
    .pipe($.htmlmin(HTMLMIN_OPTIONS))
    .pipe(gulp.dest('build/dist'))
);

gulp.task('local-js', () =>
  gulp.src(['src/js/*.js'])
    .pipe($.sourcemaps.init())
    .pipe($.babel({
      presets: ['es2015']
    }))
    .pipe($.if(!modeDev, $.rev()))
    .pipe($.sourcemaps.write())
    .pipe($.uglify({preserveComments: 'some'}))
    .pipe($.size({title: 'scripts'}))
    .pipe(gulp.dest('build/dist/js'))
    .pipe($.if(!modeDev, $.rev.manifest()))
    .pipe(gulp.dest('build/dist/js'))
);

gulp.task('vendor-js', () =>
  gulp.src(['node_modules/fg-loadcss/src/*.js'])
    .pipe($.uglify({preserveComments: 'some'}))
    .pipe($.size({title: 'scripts'}))
    .pipe(gulp.dest('build/dist/js'))
);

gulp.task('images-min', () =>
  gulp.src('src/images/**/*.{svg,png,jpg}')
    .pipe(imagemin([imagemin.gifsicle(), imageminMozjpeg(), imagemin.optipng(), imagemin.svgo()], {
      progressive: true,
      interlaced: true,
      arithmetic: true,
    }))
    .pipe(gulp.dest('build/.tmp/img'))
    .pipe($.if('**/*.{jpg,png}', $.webp()))
    .pipe($.size({title: 'images', showFiles: false}))
    .pipe(gulp.dest('build/.tmp/img'))
);

gulp.task('images', () =>
  gulp.src('build/.tmp/img/**/*.{svg,png,jpg,webp}')
    .pipe($.if(!modeDev, $.rev()))
    .pipe(gulp.dest('build/dist/img'))
    .pipe($.if(!modeDev, $.rev.manifest()))
    .pipe(gulp.dest('build/dist/img'))
);

gulp.task('copy', (cb) => {
  gulp.src([
    'src/*.{ico,html,txt,json,webapp,xml}',
    'src/.htaccess'
  ], {
    dot: true
  })
    .pipe($.size({title: 'copy', showFiles: true}))
    .pipe(gulp.dest('build/dist'))
    .on('end', () => cb())
});

gulp.task('service-worker', ['bundle-sw'], (cb) => {
  gulp.src(`build/.tmp/workbox-sw.prod.v1.1.0.js`)
    .pipe(gulp.dest(`build/dist`));

  gulp.src(`build/.tmp/{service-worker.js,sw.js}`)
    .pipe($.sourcemaps.init())
    .pipe($.sourcemaps.write())
    .pipe($.uglify({preserveComments: 'none'}))
    .pipe($.size({title: 'scripts'}))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(`build/dist`))
    .on('end', () => cb())
});

gulp.task('bundle-sw', () => {

  return wbBuild.generateSW({
    cacheId: `mixteen`,
    globDirectory: './build/dist',
    swDest: 'build/.tmp/sw.js',
    staticFileGlobs: ['**\/*.{js,html,css,png,jpg,json,gif,svg,webp,eot,ttf,woff,woff2,gz}'],
    // 	When handleFetch is set to false all requests will go to the network. This is useful during development if you
    // don't want the service worker from preventing updates.
    handleFetch: true,
    runtimeCaching: [
      {
        urlPattern: '/(.*)',
        handler: 'networkFirst',
        options: {
          cacheName: 'general-cache',
          cacheExpiration: {
            networkTimeoutSeconds: 3,
            maxAgeSeconds: 7200
          },
          broadcastCacheUpdate: {
            channelName: 'precache-updates'
          }
        }
      },
      {
        urlPattern: '/img/(.*)',
        handler: 'staleWhileRevalidate',
        options: {
          cacheName: 'image-cache',
          cacheExpiration: {
            networkTimeoutSeconds: 3,
            maxAgeSeconds: 7200
          },
          broadcastCacheUpdate: {
            channelName: 'precache-updates'
          }
        }
      }
    ],
    clientsClaim: true
  })
    .then(() => {
      console.log('Service worker generated.');
    })
    .catch((err) => {
      console.log('[ERROR] This happened: ' + err);
    });
});

gulp.task('cache-busting', (cb) => {
  const replaceInExtensions = ['.js', '.css', '.html', '.xml'];
  const manifestImg = gulp.src('build/dist/img/rev-manifest.json');
  const manifestCss = gulp.src('build/dist/css/rev-manifest.json');
  const manifestJs = gulp.src('build/dist/js/rev-manifest.json');

  gulp.src(['build/dist/events/**/*.html'])
    .pipe(firebaseImgCacheBusting('build/dist/img/rev-manifest.json', modeDev))

  gulp.src(['build/dist/**/*.{html,js,css,xml}'])
    .pipe($.revReplace({manifest: manifestImg, replaceInExtensions: replaceInExtensions}))
    .pipe($.revReplace({manifest: manifestCss}))
    .pipe($.revReplace({manifest: manifestJs}))
    .pipe(gulp.dest('build/dist'))
    .on('end', () => cb());
});

gulp.task('compress-svg', (cb) => {
  gulp.src('build/dist/**/*.svg')
    .pipe($.svg2z())
    .pipe(gulp.dest('build/dist'))
    .on('end', () => cb())
});

gulp.task('compress', ['compress-svg'], (cb) => {
  gulp.src('build/dist/**/*.{js,css,png,webp,jpg,html}')
    .pipe($.gzip())
    .pipe(gulp.dest('build/dist'))
    .on('end', () => cb())
});

gulp.task('serveAndWatch', ['initModeDev', 'build'], () => {
  browserSync.init({
    server: {
      baseDir: "./build/dist/"
    },
    notify: false,
    port: 3000
  });

  gulp.watch('src/**/*.html', ['html', browserSync.reload]);
  gulp.watch('src/**/*.{scss,css}', ['styles', browserSync.reload]);
  gulp.watch('src/**/*.adoc', ['events', browserSync.reload]);
  gulp.watch('src/**/*.js', ['lint', 'local-js', browserSync.reload]);
  gulp.watch('src/images/**/*', ['images', browserSync.reload]);
  gulp.watch('src/**/*.hbs', ['events', 'html', browserSync.reload]);
});


gulp.task('clean', () => del('build', {dot: true}));

gulp.task('initModeDev', () => modeDev = true);

gulp.task('build', cb => {
  // Hack to be able to stop the task when the async firebase requests are complete
  gulp.on('stop', () => {
    if (!modeDev) {
      process.nextTick(() => process.exit(0));
    }
  });

  runSequence(
    'styles',
    'events',
    'images-min',
    'images',
    'lint',
    ['html', 'local-js', 'vendor-js'],
    'copy',
    'service-worker',
    cb
  )
});


// Build production files, the default task
gulp.task('default', cb =>
  runSequence(
    'clean',
    'build',
    'cache-busting',
    'compress',
    cb
  )
);

// Build dev files
gulp.task('serve', cb =>
  runSequence(
    'initModeDev',
    'build',
    'serveAndWatch',
    cb
  )
);
