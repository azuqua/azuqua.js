var assert = require('chai').assert;
var Azuqua = require('../azuqua.js/azuqua.js');

describe('Azuqua JS client unit tests', function () {
  describe('Client should produce the correct hash', function () {
    Azuqua.generateHeaders('GET', '/flo/:alias/invoke', 'fakekeyhere', 'fakesecrethere');

  });
});