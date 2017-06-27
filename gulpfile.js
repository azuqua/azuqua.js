const gulp = require('gulp');
const babel = require('gulp-babel');
const watch = require('gulp-watch');
 
gulp.task('default', () => {
  return watch('src/kenetix.js', () => {
    console.log('Recompiling@' + (new Date()).toGMTString());
    gulp.src('./src/kenetix.js')
        .pipe(babel({
          presets: ['es2015', 'es2016', 'stage-2']
        }))
      .pipe(gulp.dest('./dist/'));
  });
});
