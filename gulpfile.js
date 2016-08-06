const gulp = require('gulp');
const babel = require('gulp-babel');
const watch = require('gulp-watch');
 
gulp.task('default', () => {
  return watch('src/azuqua.js', () => {
    console.log('Recompiling');
    gulp.src('./src/azuqua.js')
        .pipe(babel({
          presets: ['es2015', 'es2016', 'stage-2']
        }))
        .pipe(gulp.dest('azuqua.js'));
  });
});