'use strict';
import {dest, parallel, series, src, task, watch} from 'gulp';
import {DevMindGulpBuilder} from 'devmind-website';

import * as del from 'del';
import * as fs from 'fs';
import * as sourcemaps from 'gulp-sourcemaps';
import * as sass from 'gulp-sass';
import * as postcss from 'gulp-postcss';
import * as cssnano from 'cssnano';
import * as rev from 'gulp-rev';
import * as size from 'gulp-size';
import * as autoPrefixer from "autoprefixer";
import * as htmlmin from 'gulp-htmlmin';
import * as babel from 'gulp-babel';
import * as uglify from 'gulp-uglify';
import * as replace from 'gulp-replace';
import * as revReplace from 'gulp-rev-replace';
import * as imagemin from 'gulp-imagemin';
import * as workboxBuild from './node_modules/workbox-build/build/index.js'

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
  minifyCSS: true,
  minifyJS: true,
  jsmin: true
};

const HANDLEBARS_PARTIALS = [
  {key: '_html_header', path: 'src/templates/_html_header.handlebars'},
  {key: '_page_header', path: 'src/templates/_page_header.handlebars'},
  {key: '_page_footer', path: 'src/templates/_page_footer.handlebars'},
  {key: '_html_footer', path: 'src/templates/_html_footer.handlebars'}
];

const CACHE_BUSTING_EXTENSIONS = ['.js', '.css', '.html', '.xml', '.handlebars'];

const website = new DevMindGulpBuilder({
  metadata: {
    rss: 'src/metadata/rss.json',
    blog: 'src/metadata/blog.json',
    html: 'src/metadata/html.json',
    sitemap: 'src/metadata/sitemap.json',
  },
  dirNames: [
    'blog/',
    'books/'
  ]
});

// Service worker version is read in a file
const SW_VERSION_FILE = './version';
const serviceWorkerVersion = require(SW_VERSION_FILE).swVersion;

// Clean the working directories
// =============================
task('clean', () => del('build'));

// Compile sass file in css
// =============================
task('styles', (cb) => {
  src(['src/sass/main.scss', 'src/sass/bloglist.scss', 'src/sass/blog/blog.scss'])
    .pipe(sass({precision: 10}).on('error', sass.logError))
    .pipe(dest('build/.tmp/css'))
    .pipe(rev())
    .pipe(sourcemaps.init())
    .pipe(postcss([autoPrefixer(), cssnano()]))
    .pipe(sourcemaps.write('./'))
    .pipe(size({title: 'styles'}))
    .pipe(dest('build/dist/css'))
    .pipe(rev.manifest())
    .pipe(dest('build/dist/css'))
    .on('end', () => cb())
});

// Blog generation
// =============================
// Step 1 : create a json file which contains all blog post descriptions
task('blog-indexing', () =>
  src('src/blog/**/*.adoc')
    .pipe(website.readAsciidoc())
    .pipe(website.convertToHtml())
    .pipe(website.convertToJson('blogindex.json'))
    .pipe(dest('build/.tmp'))
);

// Step 2 : generate an xml file for the RSS lovers
task('blog-rss', () =>
  src('build/.tmp/blogindex.json')
    .pipe(website.readIndex())
    .pipe(website.convertToRss('blog.xml'))
    .pipe(dest('build/dist/rss'))
);
// Step 3 : create index page with all blog post entries (the aim is to display the last 2 blog posts on homepage
task('blog-index', () =>
  src('build/.tmp/blogindex.json')
    .pipe(website.readIndex())
    .pipe(website.convertToBlogList('src/templates/index.handlebars', HANDLEBARS_PARTIALS, 'index.html', 1))
    .pipe(dest('build/.tmp'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist'))
);
// Step 4 : create a page with the last 5 blog post entries (this the blog page on the website)
task('blog-list', () =>
  src('build/.tmp/blogindex.json')
    .pipe(website.readIndex())
    .pipe(website.convertToBlogList('src/templates/blog_list.handlebars', HANDLEBARS_PARTIALS, 'blog.html', 4))
    .pipe(dest('build/.tmp'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist'))
);
// Step 5 : create a page for people who wants to navigate in blog archive
task('blog-archive', () =>
  src('build/.tmp/blogindex.json')
    .pipe(website.readIndex())
    .pipe(website.convertToBlogList('src/templates/blog_archive.handlebars', HANDLEBARS_PARTIALS, 'blog_archive.html', 0))
    .pipe(dest('build/.tmp'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist'))
);
// Step 6 (last one) : generate an HTML page for each blog entry write in asciidoc
task('blog-page', (cb) => {
  src('src/blog/**/*.adoc')
    .pipe(website.readAsciidoc())
    .pipe(website.convertToHtml())
    .pipe(website.highlightCode({selector: 'pre.highlight code'}))
    .pipe(website.convertToBlogPage('src/templates/blog.handlebars', HANDLEBARS_PARTIALS, 'build/.tmp/blogindex.json'))
    .pipe(dest('build/.tmp/blog'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist/blog'))
    .on('end', () => cb())
});

task('blog', series(
  'blog-indexing',
  parallel('blog-page', 'blog-list', 'blog-rss', 'blog-archive', 'blog-index')
));

// task('book', (cb) =>
//   convertToGitBook([ {src: 'src/books/microbit-exercices', dist: 'build/dist/books/microbit/exercices'} ], cb));

// Step 1 : create a json file which contains all book pages descriptions
task('books-indexing', () =>
  src('src/books/**/index.adoc')
    .pipe(website.readAsciidoc())
    .pipe(website.convertToHtml())
    .pipe(website.convertToJson('bookindex.json'))
    .pipe(dest('build/.tmp/books'))
);

// Step 2 : create a page for people who wants to navigate in blog archive
task('books-archive', () =>
  src('build/.tmp/books/bookindex.json')
    .pipe(website.readIndex())
    .pipe(website.convertToBlogList('src/templates/books_archive.handlebars', HANDLEBARS_PARTIALS, 'books.html', 0))
    .pipe(dest('build/.tmp'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist'))
);

// Step 3 (last one) : generate an HTML page for each blog entry write in asciidoc
task('books-page', (cb) => {
  src('src/books/**/index.adoc')
    .pipe(website.readAsciidoc())
    .pipe(website.convertToHtml())
    .pipe(website.highlightCode({selector: 'pre.highlight code'}))
    .pipe(website.convertToBlogPage('src/templates/books.handlebars', HANDLEBARS_PARTIALS, 'build/.tmp/books/bookindex.json'))
    .pipe(dest('build/.tmp/books'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist/books'))
    .on('end', () => cb())
});

task('books', series('books-indexing', 'books-archive', 'books-page'));


// HTML pages generation
// =============================
task('html-indexing', () =>
  src(`src/html/**/*.html`)
    .pipe(website.readHtml())
    .pipe(website.convertToJson('pageindex.json'))
    .pipe(dest('build/.tmp')));

task('html-template', () =>
  src(`src/html/**/*.html`)
    .pipe(website.readHtml())
    .pipe(website.applyTemplate(`src/templates/site.handlebars`, HANDLEBARS_PARTIALS))
    .pipe(size({title: 'html', showFiles: true}))
    .pipe(dest('build/.tmp'))
    .pipe(htmlmin(HTMLMIN_OPTIONS))
    .pipe(dest('build/dist')));

task('html', parallel('html-indexing', 'html-template'));

// Javascript files
// =============================
task('local-js', () =>
  src(['src/js/*.js'])
    .pipe(babel({presets: ['@babel/env']}))
    .pipe(rev())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(size({title: 'scripts'}))
    .pipe(replace('$serviceWorkerVersion', serviceWorkerVersion))
    .pipe(sourcemaps.write())
    .pipe(dest('build/dist/js'))
    .pipe(rev.manifest())
    .pipe(dest('build/dist/js'))
);

task('vendor-js', () =>
  src(['node_modules/fg-loadcss/src/*.js'])
    .pipe(uglify())
    .pipe(dest('build/dist/js'))
);

// Images files
// =============================
// minify assets
task('images-minify', () =>
  src('src/images/**/*.{svg,png,jpg}')
    .pipe(imagemin([
      imagemin.gifsicle({interlaced: true}),
      imagemin.mozjpeg({progressive: true}),
      imagemin.optipng(),
      imagemin.svgo()]))
    .pipe(size({title: 'images', showFiles: false}))
    .pipe(dest('build/.tmp/img'))
);
// In dev mode copy are just copied
task('images-dev', () =>
  src('src/images/**/*.{svg,png,jpg}').pipe(dest('build/.tmp/img'))
);

// Images generated in image pre processing are renamed with a MD5 (cache busting) and copied in the dist directory
task('images', () =>
  src('build/.tmp/img/**/*.{svg,png,jpg,webp}')
    .pipe(rev())
    .pipe(dest('build/dist/img'))
    .pipe(rev.manifest())
    .pipe(dest('build/dist/img'))
);

// Copy static files
// =============================
task('copy', (cb) =>
  src(['src/*.{ico,html,txt,pdf,json,webapp,xml}', 'src/**/*.htaccess', 'src/**.*.pdf', 'node_modules/workbox-sw/build/*-sw.js'], {dot: true})
    .pipe(size({title: 'copy', showFiles: true}))
    .pipe(dest('build/dist'))
    .on('end', () => cb())
);

// Service workers
// =============================
const SW_MANIFEST_OPTIONS = {
  swSrc: 'src/sw.js',
  swDest: 'build/.tmp/sw.js',
  globDirectory: './build/dist',
  globIgnores: ['**/sw*.js', '**/workbox*.js'],
  globPatterns: ['**/*.{js,svg}']
};

task('service-worker-bundle', () =>
  workboxBuild.injectManifest(SW_MANIFEST_OPTIONS)
    .then(({count, size, warnings}) => {
      // Optionally, log any warnings and details.
      warnings.forEach(console.warn);
      console.log(`${count} files will be precached, totaling ${size} bytes.`);
    })
    .catch((err) => {
      console.log('[ERROR] This happened: ' + err);
    })
);

task('service-worker-optim', () =>
  src(`build/.tmp/*.js`)
    .pipe(rev())
    .pipe(replace('$serviceWorkerVersion', serviceWorkerVersion))
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write())
    //.pipe(uglify())
    .pipe(size({title: 'scripts'}))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(`build/dist`))
    .pipe(rev.manifest())
    .pipe(dest(`build/dist`))
);

task('service-worker-updgrade', (fg) => {
  const errorCallback = (err) => {
    if (err) throw err;
    console.log('File with version saved!');
  };
  // We have to save the new service worker version for next build
  fs.writeFile(SW_VERSION_FILE + '.json', '{ "swVersion" : ' + (serviceWorkerVersion + 1) + '}', errorCallback);
  fg();
});

task('service-worker', series('service-worker-bundle', 'service-worker-optim', 'service-worker-updgrade'));

// Site
// =============================
task('sitemap', () =>
  src(['build/.tmp/blogindex.json', 'build/.tmp/pageindex.json'])
    .pipe(website.convertToSitemap())
    .pipe(dest('build/dist'))
);

// Cache busting
// =============================
const cacheBusting = (path, target?: string) =>
src(path)
  .pipe(revReplace({
    manifest: src('build/dist/img/rev-manifest.json'),
    replaceInExtensions: CACHE_BUSTING_EXTENSIONS
  }))
  .pipe(revReplace({
    manifest: src('build/dist/css/rev-manifest.json'),
    replaceInExtensions: CACHE_BUSTING_EXTENSIONS
  }))
  .pipe(revReplace({
    manifest: src('build/dist/js/rev-manifest.json'),
    replaceInExtensions: CACHE_BUSTING_EXTENSIONS
  }))
  .pipe(dest(target ? target : 'build/dist'));

task('cache-busting-dev', () => cacheBusting('build/dist/**/*.{html,js,css}'));
task('cache-busting', () => cacheBusting('build/dist/**/*.{html,js,css,xml,json,webapp}'));
task('cache-busting-sw', () =>
  src('build/dist/**/main*.js')
    .pipe(revReplace({manifest: src('build/dist/rev-manifest.json'), replaceInExtensions: ['.js']}))
    .pipe(dest('build/dist')));

// Watcher used in dev
// =============================
task('watch-html', () =>
  watch('src/**/*.html', series('html', 'cache-busting-dev')));
task('watch-scss', () =>
  watch('src/**/*.{scss,css}', series('styles', 'blog', 'training', 'html', 'cache-busting-dev')));
task('watch-adoc', () =>
  watch('src/**/*.adoc', series('blog', 'training', 'cache-busting-dev')));
task('watch-js', () =>
  watch('src/**/*.js', series('local-js', 'blog', 'training', 'html', 'cache-busting-dev')));
task('watch-img', () =>
  watch('src/images/**/*', series('images', 'blog', 'training', 'html', 'cache-busting-dev')));
task('watch-template', () =>
  watch('src/**/*.handlebars', series('blog', 'training', 'html', 'cache-busting-dev')));

task('watch', parallel('watch-html', 'watch-scss', 'watch-adoc', 'watch-js', 'watch-img', 'watch-template'));


task('build', series(
  'images-minify',
  'styles',
  'blog',
  'books',
  'images',
  'html',
  'local-js',
  'vendor-js',
  'copy',
  'cache-busting',
  'service-worker',
  'cache-busting-sw'
));

task('build-dev', series(
  'clean',
  'images-dev',
  'styles',
  'blog',
  'books',
  'images',
  'html',
  'local-js',
  'vendor-js',
  'copy',
  'cache-busting',
  'service-worker',
  'cache-busting-sw'));

//
// // Build production files, the default task
task('default', series('clean', 'build', 'sitemap'));

// // Build dev files
task('serve', series('build-dev', 'watch'));
