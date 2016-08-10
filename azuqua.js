'use strict';

// Standard Lib modules

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var url = require('url');
var crypto = require('crypto');
var querystring = require('querystring');
var path = require('path');
var fs = require('fs');

// External modules
var fetch = require('node-fetch');
var Promise = require('bluebird');
var _ = require('lodash');

// Use bluebird for promises
fetch.Promise = Promise;

var paramRegex = /:\w+/;

/**
 * `AzuquaCallback`
 * @callback azuquaCallback
 * @param {object} Error - An error object containing information about the error
 * @param {object} Response - A response object containing relevant response information
 */

// Checks if the response is within error range and if it is - throws an error
function checkResponseError(response) {
  if (response.status < 200 || response.status >= 400) {
    return response.json().then(function (json) {
      throw json;
    });
  } else {
    return response;
  }
};

// Promise 'middleware' takes the fetch response and converts it to a JS object
function toJSON(response) {
  return response.json();
}

// errorHandler for network/fetch errors. Provides a bit more information to the user
function errorHandler(error) {
  if (error.name === 'FetchError') {
    var formattedError = new Error('Error reaching requested resource');
    formattedError.name = 'Request Error';
    throw formattedError;
  } else {
    throw error;
  }
}

// Basic ending error function - easy single point of access for more complex error handling
function handleErrorCallback(cb) {
  return function (error) {
    cb(error, null);
  };
}

/** Class representing an Azuqua instance */

var Azuqua = function () {
  /**
   * Creates an azuqua instance with given Access Key and Access Secret
   * @constructor
   * @param {string} accessKey - The access key associated with the Azuqua account
   * @param {string} accessSecret - The access secret associated with the Azuqua account
   * @param {object} [httpOptions] - An httpOptions object to override default httpOptions
   */
  function Azuqua(accessKey, accessSecret, httpOptions) {
    _classCallCheck(this, Azuqua);

    // Properties
    this.account = {};
    this.account.accessKey = undefined;
    this.account.accessSecret = undefined;

    // Cached Flos
    this._flos = null;

    if (process.env.ACCESS_KEY) {
      this.account.accessKey = process.env.ACCESS_KEY;
    }
    if (process.env.ACCESS_SECRET) {
      this.account.accessSecret = process.env.ACCESS_SECRET;
    }
    if (typeof accessKey === 'string') {
      this.account.accessKey = accessKey;
    }
    if (typeof accessSecret === 'string') {
      this.account.accessSecret = accessSecret;
    }

    this.protocol = 'https';
    this.httpOptions = {
      host: 'api.azuqua.com',
      port: 443
    };

    if ((typeof httpOptions === 'undefined' ? 'undefined' : _typeof(httpOptions)) === 'object') {
      this.httpOptions = _extends({}, this.httpOptions, httpOptions);
    }

    this.protocol = this.httpOptions.port === 443 ? 'https' : 'http';

    Object.freeze(this.httpOptions);
  } // End of constructor

  /**
   * Read all flos related to the given user account
   * @example
   * // Returns a list of flo objects - forcing the method to ignore caching
   * azuqua.flos(true).then(function(flos) {
   *  flos.forEach(function(flo) {
   *    // Do something with each flo
   *  })
   * }).catch(function(error) {
   *  // Handle error
   *  console.log('Error: ', error);
   * })
   * @param {boolean} [force=false] - Option to force flos to ignore cached flos and make new network request
   * @param {azuquaCallback} [cb] - Callback function that handles flos response
   */


  _createClass(Azuqua, [{
    key: 'flos',
    value: function flos(force, cb) {
      var _this = this;

      if (typeof force === 'function') {
        cb = force;
        force = false;
      } else if (typeof force !== 'function' && typeof cb !== 'function') {
        return Promise.promisify(this.flos).bind(this)(force);
      }
      if (!force && this._flos !== null) {
        return cb(null, this._flos);
      }
      this.makeRequest('GET', '/account/flos', {}).then(function (json) {
        _this._flos = json.map(function (flo) {
          return new Flo(flo);
        });
        cb(null, _this._flos);
      }).catch(handleErrorCallback(cb));
    } // End get flos method

    /**
     * Read information about a particular flo
     * @example
     * // Returns a flo object representing a particular flo
     * azuqua.read('exampleFloAlias').then(function(flo) {
     *  // Do something with flo response
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles read response
     */

  }, {
    key: 'read',
    value: function read(flo, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.read).bind(this)(flo);
      }
      var alias = typeof flo === 'string' ? flo : flo.alias;
      var params = { alias: alias };
      this.makeRequest('GET', '/flo/:alias/read', params).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Invoke a flo with the given parameter information
     * @example
     * // Invokes a flo with given data
     * azuqua.invoke('exampleFloAlias', { data : { 'name' : 'Azuqua' } }).then(function(response) {
     *  // Do something with invoke response
     * }).catch(function(error) {
     *  // Handle the invoke error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {object} params - An object containing the params needed to invoke the flo
     * @param {azuquaCallback} [cb] - Callback function that handles the invoke response
     */

  }, {
    key: 'invoke',
    value: function invoke(flo, params, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.invoke).bind(this)(flo, params);
      }
      var alias = typeof flo === 'string' ? flo : flo.alias;
      params.alias = alias;
      this.makeRequest('POST', Azuqua.routes.invoke.path, params).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Read the inputs of a particular flo
     * @example
     * // Reads the inputs of a flo
     * azuqua.inputs('exampleFloAlias').then(function(inputs) {
     *  // Do something with input data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles the inputs response
     */

  }, {
    key: 'inputs',
    value: function inputs(flo, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.inputs).bind(this)(flo);
      }
      var alias = typeof flo === 'string' ? flo : flo.alias;
      var params = {};
      params.alias = alias;
      this.makeRequest('GET', Azuqua.routes.inputs.path, params).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * @example
     * // Reads the inputs of a flo
     * azuqua.inputs('exampleFloAlias').then(function(inputs) {
     *  // Do something with input data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * Returns the orgs related to the particular user
     * @param {azuquaCallback} [cb] - Callback function that handles the inputs response
     */

  }, {
    key: 'groups',
    value: function groups(cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.groups).bind(this)();
      }
      this.makeRequest('GET', 'user/orgs', {}).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * A generic function that allows request to arbitrary routes. Handles building the headers before sending the request
     * @example
     * // Make a generic request to an azuqua api - signing the request with proper headers
     * azuqua.makeRequest('GET', 'flo/:alias/invoke', 
     * { alias : 'example alias', data : { name : 'Azuqua', location : 'Seattle' } })
     *  .then(function(response) {
     *   // Do something with response data
     *  }).catch(function(error) {
     *   // Handle the error
     *   console.log('Error: ', error);
     *  })
     * @param {string} _method - The HTTP method
     * @param {string} _path - The path of the desired resource. 
     * @param {object} [_params] - Additional params that will be parsed and passed to the request
     */

  }, {
    key: 'makeRequest',
    value: function makeRequest(_method, _path) {
      var _params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      if (!this.account.accessKey || !this.account.accessSecret) {
        return Promise.reject(new Error('Account information not provided'));
      }

      var route = null;
      var method = _method.toUpperCase();
      var headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      var data = null;

      // TODO: Potentially allow http options override on individual request

      // Set data 
      if (method === 'GET') {
        data = '';
      } else {
        if (_params.data) {
          data = JSON.stringify(_params.data);
        }
      }

      // Dynamically fill in peth with params
      var urlRegex = /:\w+/;
      var formattedUrl = url.parse(_path).format();
      var urlComponents = formattedUrl.split('/');
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = urlComponents[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var component = _step.value;

          if (urlRegex.test(component)) {
            var name = component.substring(1);
            var replacement = _params[name];
            if (!replacement) {
              return Promise.reject('Mismatch between url params and passed params');
            } else {
              formattedUrl = formattedUrl.replace(component, replacement);
              // Not sure if we need this
              delete _params[name];
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      route = formattedUrl + (Object.keys(_.omit(_params, ['data'])).length > 0 ? '?' + querystring.stringify(_.omit(_params, ['data'])) : '');

      var authHeaders = Azuqua.generateHeaders(method, route, this.account.accessKey, this.account.accessSecret, _params);

      var requestUrl = this.protocol + '://' + this.httpOptions.host + ':' + this.httpOptions.port + route;

      // The .then basically triggers the error handler on our flo methods
      return fetch(requestUrl, {
        method: method,
        headers: _extends({}, headers, authHeaders),
        body: data
      }).then(checkResponseError).then(toJSON).catch(errorHandler);
    } // End make request method

  }, {
    key: 'loadConfig',
    value: function loadConfig(_path) {
      // Resolve the config path from the requiring parent's location if it's relative
      _path = path.resolve(path.dirname(module.parent.filename), _path);
      this.account = require(_path);
    }
  }, {
    key: 'loadConfigAsync',
    value: function loadConfigAsync(_path, cb) {
      var _this2 = this;

      _path = path.resolve(path.dirname(module.parent.filename), _path);
      fs.readFile(_path, function (error, data) {
        if (error) {
          cb(error, null);
        } else {
          try {
            var config = JSON.parse(data);
            _this2.account = config;
            cb(null, config);
          } catch (e) {
            cb(e, null);
          }
        }
      });
    }

    /**
     * A generic function that generates the headers for a particular request
     * @example
     * // Produce an object with valid API headers generated from params (Notice it's static')
     * Azuqua.generateHeaders('GET', 'flo/:alias/invoke', 'myaccesskey', 'myaccesssecret', {
     *  data : {
     *    name : 'Azuqua'
     *  }
     * })
     * @param {string} method - The HTTP method
     * @param {string} path - The path of the desired resource. 
     * @param {string} accessKey - The requesters access key
     * @param {string} accessSecret - The requesters access secret
     * @param {object} [params] - Additional data needed for the hash (if applicable)
     */

  }], [{
    key: 'generateHeaders',
    value: function generateHeaders(method, path, accessKey, accessSecret) {
      var params = arguments.length <= 4 || arguments[4] === undefined ? '' : arguments[4];

      // Default params don't override null and we can't send null data
      var data = params ? params.data : '';
      if (!data) {
        data = '';
      }

      if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
        data = JSON.stringify(data);
      }

      var pathQueryString = void 0;
      if (method === 'GET') {
        var queryObject = url.parse(path, true).query;
        if (Object.keys(queryObject).length > 0) {
          pathQueryString = JSON.stringify(queryObject);
        } else {
          pathQueryString = '';
        }
      } else {
        pathQueryString = data || '{}';
      }

      var timestamp = new Date().toISOString();

      var meta = [method.toLowerCase(), path, new Date().toISOString()].join(':') + pathQueryString;
      var hash = crypto.createHmac('sha256', accessSecret).update(new Buffer(meta, 'utf-8')).digest('hex');

      return {
        'x-api-hash': hash,
        'x-api-accesskey': accessKey,
        'x-api-timestamp': timestamp
      };
    } // End of generateHeaders

    // Declare routes

  }, {
    key: 'routes',
    get: function get() {
      return {
        invoke: {
          path: '/flo/:alias/invoke',
          method: 'POST'
        },
        inject: {
          path: '/flo/:alias/inject',
          method: 'POST'
        },
        flos: {
          path: '/account/flos',
          method: 'GET'
        },
        schedule: {
          path: '/flo/:alias/schedule',
          method: 'POST'
        },
        retry: {
          path: '/flo/:alias/retry',
          method: 'POST'
        },
        inputs: {
          path: '/flo/:alias/inputs',
          method: 'GET'
        }
      };
    } // End of route declarations

  }]);

  return Azuqua;
}(); // End of Azuqua class declaration

/** 
 * Class representing a Flo instance 
 * @property {String}  id             - ID for the flo.
 * @property {String}  alias          - Alias of the flo.
 * @property {String}  name           - Name of the flo.
 * @property {String}  version        - Version of the flo.
 * @property {Boolean} active         - Value indicating whether a flo has turned on.
 * @property {Boolean} published      - Value indicating whether a flo has been published or not.
 * @property {String}  security_level - Security level access for a flo.
 * @property {String}  client_token   - Client Token for a flo.
 * @property {String}  description    - Flo's description.
 * @property {Date}    created
 * @property {Date}    updated
 * */


var Flo =
/**
 * Creates a Flo instance with given Flo data
 * @constructor
 * @param {Object} floObject - Object containing the data to build the flo with
 */
function Flo(floObject) {
  _classCallCheck(this, Flo);

  _.extend(this, floObject);
};

module.exports = Azuqua;