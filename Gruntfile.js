module.exports = function (grunt_) {

  var configObject = {
    pkg: grunt_.file.readJSON("package.json"),

    jshint: {
      all: [ 
        'Gruntfile.js', 
        'azuqua.js'
      ],
      options: {}
    },

        // Execute server-side Mocha tests using the grunt-mocha-test module.
        // (Use grunt-mocha module for headless client-side testing within PhantomJS).
        mochaTest: {
          test: {
            options: { reporter: 'spec', checkLeaks: true },
          },
          src: ['test/test.js']
        }
      };

      grunt_.initConfig(configObject);

      grunt_.loadNpmTasks("grunt-contrib-jshint");
      grunt_.loadNpmTasks("grunt-mocha-test");

      grunt_.registerTask("lint", [ "jshint" ]);
      grunt_.registerTask("test", [ "mochaTest" ]);
      grunt_.registerTask("default", [ "lint", "test" ]);
    };
