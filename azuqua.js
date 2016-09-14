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
  return response.text().then(function (text) {
    try {
      var responseJson = JSON.parse(text);
      return Promise.resolve(responseJson);
    } catch (e) {
      return Promise.reject({
        type: 'ResponseParsingError',
        message: 'Error trying to parse the following server response as JSON: ' + text
      });
    }
  });
}

// errorHandler for network/fetch errors. Provides a bit more information to the user
function errorHandler(error) {
  if (error.name === 'FetchError') {
    return Promise.reject({
      type: 'FetchError',
      message: 'Failed to reach requested resource'
    });
  } else {
    var message = 'There was an error in the request process';
    if (error.message) {
      message = error.message;
    }
    return Promise.reject({
      type: 'Error',
      message: message
    });
  }
}

// Basic ending error function - easy single point of access for more complex error handling
function handleErrorCallback(cb) {
  return function (error) {
    cb(error, null);
  };
}

function makeAliasEndpoint(flo, endpoint) {
  var alias = typeof flo === 'string' ? flo : flo.alias;
  var endpointWithAlias = endpoint.replace(':alias', alias);
  return endpointWithAlias;
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
   * @param {object} [params] - Optional information to pass to /account/flos route
   * @param {azuquaCallback} [cb] - Callback function that handles flos response
   */


  _createClass(Azuqua, [{
    key: 'flos',
    value: function flos(force, params, cb) {
      var _this = this;

      if (typeof force === 'function') {
        cb = force;
        force = false;
        params = {};
      } else if (typeof params === 'function') {
        cb = params;
        params = {};
      } else if (typeof force !== 'function' && typeof cb !== 'function' && typeof params !== 'function') {
        return Promise.promisify(this.flos).bind(this)(force, params);
      }
      if (!force && this._flos !== null) {
        return cb(null, this._flos);
      }
      this.makeRequest('GET', '/account/flos', { query: params }).then(function (json) {
        _this._flos = json.map(function (flo) {
          return new Flo(flo);
        });
        cb(null, _this._flos);
      }).catch(handleErrorCallback(cb));
    }
  }, {
    key: 'read',
    value: function read(flo, cb) {
      console.log('Calling deprecated method \'read\' - please use the \'readFlo method\'');
      this.readFlo(flo, cb);
    }

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
    key: 'readFlo',
    value: function readFlo(flo, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.read).bind(this)(flo);
      }
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFlo.path);
      this.makeRequest('GET', endpoint).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Invoke a flo with the given parameter information
     * @example
     * // The params object can have a few different apperance
     * var data = {
     *  'data' : 'at the top level',
     *  'like' : 'this'
     * }
     * // This kind of format is good for F1 flos - where all data should be sent through the body
     *
     * // If you're working with the new Azuqua designer you might of noticed you can specify where
     * data should be taken from on your on demand flos
     * // In that case the client allows you to specify where the params will end up
     * var data = {
     *  headers : {
     *    'this data' : 'will be attached as additional headers'
     *  },
     *  query : {
     *    'this data' : 'will be converted to a query string and appended to the URL'
     *  },
     *  body : {
     *    'and this data' : 'will be send in the body'
     *  }
     *  'any additional data' : 'will also be send in the body object'
     * }
     * // Invokes a flo with given data
     * azuqua.invoke('exampleFloAlias', { 'name' : 'Azuqua' }).then(function(response) {
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.invoke.path);
      this.makeRequest('POST', endpoint, params).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Injects data into a flo with the given parameter information
     * @example
     * // Injects a flo with given data
     * azuqua.inject('exampleFloAlias', { 'name' : 'Azuqua' }).then(function(response) {
     *  // Do something with inject response
     * }).catch(function(error) {
     *  // Handle the inject error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {object} params - An object containing the params needed to inject the flo
     * @param {azuquaCallback} [cb] - Callback function that handles the inject response
     */

  }, {
    key: 'inject',
    value: function inject(flo, params, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.inject).bind(this)(flo, params);
      }
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.inject.path);
      this.makeRequest('POST', endpoint, params).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Enables a flo
     * @example
     * // Enables the flo or flo with alias
     * azuqua.enable('exampleFloAlias').then(function(response) {
     *  // Do something with enable response
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles the enable response
     */

  }, {
    key: 'enable',
    value: function enable(flo, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.enable).bind(this)(flo);
      }
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.enable.path);
      this.makeRequest('POST', endpoint).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Disables a flo
     * @example
     * // Disables the flo or flo with alias
     * azuqua.disable('exampleFloAlias').then(function(response) {
     *  // Do something with disable response
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles the disable response
     */

  }, {
    key: 'disable',
    value: function disable(flo, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.disable).bind(this)(flo);
      }
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.disable.path);
      this.makeRequest('POST', endpoint).then(function (json) {
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.inputs.path);
      this.makeRequest('GET', endpoint).then(function (json) {
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
     * @param {azuquaCallback} [cb] - Callback function that handles the groups response
     */

  }, {
    key: 'groups',
    value: function groups(params, cb) {
      if (typeof params === 'function') {
        cb = params;
        params = {};
      }
      if (typeof params !== 'function' && typeof cb !== 'function') {
        return Promise.promisify(this.groups).bind(this)(params);
      }
      this.makeRequest('GET', Azuqua.routes.groups.path, { query: params }).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Create an Azuqua rule
     * @example
     * var rule = {
     *   'conditions': {
     *     'identifiers': [],
     *     'expr': 'avg(.data.outside.temp) > 30 and .data.humidity < 20',
     *     'scope': 'user',
     *     'id': my_id
     *   },
     *   'policy': '',
     *   'org_id': my_org_id,
     *   'user_id': my_id
     * }
     * // Creates and returns a rule object representing a particular rule
     * azuqua.createRule(rule).then(function(rule) {
     *  // Do something with rule response (Rule was created)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {Rule} rule - The rule object representing the created rule
     * @param {azuquaCallback} [cb] - Callback function that handles create response
     */

  }, {
    key: 'createRule',
    value: function createRule(rule, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.createRule).bind(this)(rule);
      }
      this.makeRequest('POST', '/rule', { rule: rule }).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Read a particular rule with provided rule id
     * @example
     * 
     * azuqua.readRule(rule_id).then(function(rule) {
     *  // Do something with rule response 
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} id - The ID of the rule to read
     * @param {azuquaCallback} [cb] - Callback function that handles read response
     */

  }, {
    key: 'readRule',
    value: function readRule(id, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.readRule).bind(this)(id);
      }
      var endpoint = Azuqua.routes.readRule.path.replace(':id', id);
      this.makeRequest('GET', endpoint).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Update an Azuqua rule
     * @example
     * var rule = {
     *   'conditions': {
     *     'expr': 'avg(.data.inside.temp) < 50',
     *     'scope': 'flo',
     *     'id': flo_id
     *   },
     *   'policy': 'Let's update the policy!',
     * }
     * // Updates and returns a rule object representing a particular rule
     * azuqua.updateRule(rule_id, rule).then(function(rule) {
     *  // Do something with rule response (Rule was updated)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} id - The ID of the rule to read
     * @param {Rule} rule - The rule object representing the updated rule
     * @param {azuquaCallback} [cb] - Callback function that handles update response
     */

  }, {
    key: 'updateRule',
    value: function updateRule(id, rule, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.updateRule).bind(this)(id, rule);
      }
      var endpoint = Azuqua.routes.updateRule.path.replace(':id', id);
      this.makeRequest('PUT', endpoint, { rule: rule }).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Reads all the rules associated with the azuqua account
     * @example
     * // Reads all the rules associated with the given azuqua account
     * azuqua.readAllRules().then(function(rules) {
     *  // Do something with response (Array with all the rules)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {azuquaCallback} [cb] - Callback function that handles readAllRules response
     */

  }, {
    key: 'readAllRules',
    value: function readAllRules(cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.readAllRules).bind(this)();
      }
      var endpoint = Azuqua.routes.readAllRules.path;
      this.makeRequest('GET', endpoint).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * Deletes an Azuqua rule
     * @example
     * // Creates and returns a rule object representing a particular rule
     * azuqua.deleteRule(rule).then(function(rule) {
     *  // Do something with response (Rule was deleted)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} id - The ID of the rule to delete
     * @param {azuquaCallback} [cb] - Callback function that handles delete response
     */

  }, {
    key: 'deleteRule',
    value: function deleteRule(id, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.deleteRule).bind(this)(id);
      }
      var endpoint = Azuqua.routes.deleteRule.path.replace(':id', id);
      this.makeRequest('DELETE', endpoint).then(function (json) {
        cb(null, json);
      }).catch(handleErrorCallback(cb));
    }

    /**
     * @example
     * Links a Azuqua rule to a flo by each respective ID
     * // Links a rule to a flo and returns the rule
     * azuqua.linkRuleAndFlo(rule).then(function(rule) {
     *  // Do something with response (Rule was linked)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} ruleId - The ID of the rule to link
     * @param {integer} floId - The ID of the flo to link
     * @param {azuquaCallback} [cb] - Callback function that handles delete response
     */

  }, {
    key: 'linkRuleAndFlo',
    value: function linkRuleAndFlo(ruleId, floId, cb) {
      if (typeof cb !== 'function') {
        return Promise.promisify(this.linkRuleAndFlo).bind(this)(ruleId, floId);
      }
      var endpoint = Azuqua.routes.linkRuleAndFlo.path.replace(':ruleId', ruleId).replace(':floId', floId);
      this.makeRequest('POST', endpoint).then(function (json) {
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
     * @param {object} [_params] - Additional params that will be parsed and passed to the request (Incldues data that will be passed onto invoked flo)
     */

  }, {
    key: 'makeRequest',
    value: function makeRequest(_method, _path) {
      var _params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      if (!this.account.accessKey || !this.account.accessSecret) {
        return Promise.reject(new Error('Account information not provided'));
      }

      var route = _path;
      var params = _.cloneDeep(_params);
      var method = _method.toUpperCase();
      var headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      var query = {};
      var body = {};

      // Take information about of params and place it in respective place
      if (params.query) {
        if (_typeof(params.query) === 'object') {
          query = params.query;
        }
        delete params.query;
      }
      if (params.headers) {
        if (_typeof(params.headers) === 'object') {
          _.extend(headers, params.headers);
        }
        delete params.headers;
      }
      if (params.body) {
        if (_typeof(params.body) === 'object') {
          body = params.body;
        }
        delete params.body;
      }
      _.extend(body, params);

      // Represents the data that will be hashed (Which is why we stringify it)
      var data = null;

      // Set data
      if (method === 'GET' || method === 'DELETE') {
        data = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
        body = ''; // API DOESN'T EXCEPT GET WITH BODIES
      } else {
        data = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
        body = data;
      }
      if (Object.keys(query).length > 0) {
        route = route + '?' + querystring.stringify(query);
      }

      var authHeaders = Azuqua.generateHeaders(method, route, this.account.accessKey, this.account.accessSecret, data);

      var requestUrl = this.protocol + '://' + this.httpOptions.host + ':' + this.httpOptions.port + route;

      // The .then basically triggers the error handler on our flo methods
      return fetch(requestUrl, {
        method: method,
        headers: _extends({}, headers, authHeaders),
        body: body
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
     * @param {object} [data] - Additional data needed for the hash (if applicable)
     */

  }], [{
    key: 'generateHeaders',
    value: function generateHeaders(method, path, accessKey, accessSecret, data) {
      // Default params don't override null and we can't send null data
      if (!data) {
        data = '';
      }

      if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
        data = JSON.stringify(data);
      }

      // Think this can be simplified
      var pathQueryString = void 0;
      if (method === 'GET' || method === 'DELETE') {
        pathQueryString = data || '';
      } else {
        pathQueryString = data || '{}';
      }

      var timestamp = new Date().toISOString();

      var meta = [method.toLowerCase(), path, timestamp].join(':') + pathQueryString;
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
        readFlo: {
          path: '/flo/:alias/read',
          method: 'GET'
        },
        invoke: {
          path: '/flo/:alias/invoke',
          method: 'POST'
        },
        inject: {
          path: '/flo/:alias/inject',
          method: 'POST'
        },
        enable: {
          path: '/flo/:alias/enable',
          method: 'POST'
        },
        disable: {
          path: '/flo/:alias/disable',
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
        },
        groups: {
          path: '/user/orgs',
          method: 'GET'
        },
        createRule: {
          path: '/rule',
          method: 'POST'
        },
        readRule: {
          path: '/rule/:id',
          method: 'GET'
        },
        updateRule: {
          path: '/rule/:id',
          method: 'PUT'
        },
        deleteRule: {
          path: '/rule/:id',
          method: 'DELETE'
        },
        readAllRules: {
          path: '/rules',
          method: 'GET'
        },
        linkRuleAndFlo: {
          path: '/rule/:ruleId/associate/:floId',
          method: 'POST'
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