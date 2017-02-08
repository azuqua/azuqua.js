'use strict';

// Standard Lib modules

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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

// Local Requires
// Explination: Conditionally load routes try local but if run from src, load from another path
var routes = require('../static/routes');
var readDeprecationWarning = _.once(function () {
  return console.log('Read is deprecated. Please use readFlo instead');
});

/**
 * `AzuquaCallback`
 * @callback azuquaCallback
 * @param {object} Error - An error object containing information about the error
 * @param {object} Response - A response object containing relevant response information
 */

// Checks if the response is within error range and if it is - throws an error
// Error could possible not be JSON so do what we do with toJSON() and first get text then parse
// If it's not JSON reject with the text and let the error handler handle it
function checkResponseError(response) {
  if (response.status < 200 || response.status >= 400) {
    return response.text().then(function (text) {
      try {
        var responseJson = JSON.parse(text);
        throw responseJson;
      } catch (e) {
        var errProxy = { error: text };
        errProxy.name = 'Azuqua server response error (statusCode < 200 || statusCode > 400)';
        throw errProxy;
      }
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
      var errProxy = new Error('Error trying to parse the following server response as JSON: ' + text);
      errProxy.type = 'ResponseParsingError';
      throw errProxy;
    }
  });
}

// errorHandler for network/fetch errors. Provides a bit more information to the user
function errorHandler(error) {
  if (error.name === 'FetchError') {
    var errProxy = new Error('Failed to reach requested resource (' + error.code + ')');
    errProxy.type = 'FetchError';
    throw errProxy;
  } else {
    var errProxyObject = _.extend({}, error);
    if (_.isNil(errProxyObject.name)) {
      errProxyObject.name = 'Request Error';
    }
    if (_.isNil(errProxyObject.message)) {
      errProxyObject.message = 'There was an error in the request process. ' + JSON.stringify(error) + '.';
    }
    throw errProxyObject;
  }
}

// Helper function that will format the desired endpoint for the flo's alias
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
   * @example
   * // Require azuqua.js, exposing the constructor
   * const Azuqua = require('azuqua');
   * // Instantiate a new Azuqua instance
   * const azuqua = new Azuqua('accessKey', 'accessSecret', httpOptions);
   * // Use azuqua client here.
   *
   * // Can also be used with varying number of arguments.
   * // Here no arguments are passed. accessKey and secret are attempted to be loaded in from
   * // AZUQUA_ACCESS_KEY and AZUQUA_ACCESS_SECRET env variables or loaded in later with loadConfig()
   * const azuqua = new Azuqua();
   * @param {string} accessKey - The access key associated with the Azuqua account
   * @param {string} accessSecret - The access secret associated with the Azuqua account
   * @param {object} [httpOptions] - An httpOptions object to override default httpOptions
   */
  function Azuqua(accessKey, accessSecret, httpOptions) {
    _classCallCheck(this, Azuqua);

    // Default Properties
    this.account = {};
    this.account.accessKey = undefined;
    this.account.accessSecret = undefined;

    this.protocol = 'https';
    this.httpOptions = {
      host: 'api.azuqua.com',
      port: 443
    };

    // Cached Flos
    this._flos = null;

    // Enviroment Variable Logic
    if (arguments.length === 0 || arguments.length === 1) {
      // Default constructor - Look at env for key and secret
      // Could always load later with loadConfig
      if (process.env.ACCESS_KEY) {
        this.account.accessKey = process.env.ACCESS_KEY;
      }
      if (process.env.ACCESS_SECRET) {
        this.account.accessSecret = process.env.ACCESS_SECRET;
      }
      if (process.env.AZUQUA_ACCESS_KEY) {
        this.account.accessKey = process.env.AZUQUA_ACCESS_KEY;
      }
      if (process.env.AZUQUA_ACCESS_SECRET) {
        this.account.accessSecret = process.env.AZUQUA_ACCESS_SECRET;
      }
      if (arguments.length === 1 && _typeof(arguments[0]) === 'object') {
        // If we have an argument it should be http options
        this.httpOptions = _extends({}, this.httpOptions, httpOptions);
      }
    } else if (arguments.length === 2) {
      // If 2 arguments, assume they are key and secret
      // And proceed to use default http options 
      if (typeof accessKey === 'string') {
        this.account.accessKey = accessKey;
      }
      if (typeof accessSecret === 'string') {
        this.account.accessSecret = accessSecret;
      }
    } else {
      // 3 or more arguments we assume passed in correct order
      if (typeof accessKey === 'string') {
        this.account.accessKey = accessKey;
      }
      if (typeof accessSecret === 'string') {
        this.account.accessSecret = accessSecret;
      }

      if ((typeof httpOptions === 'undefined' ? 'undefined' : _typeof(httpOptions)) === 'object') {
        this.httpOptions = _extends({}, this.httpOptions, httpOptions);
      }
    }

    // Finally set port
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

      return this.makeRequest('GET', '/account/flos', { query: params }).then(function (json) {
        _this._flos = json.map(function (flo) {
          return new Flo(flo);
        });
        return json;
      }).asCallback(cb);
    }
  }, {
    key: 'read',
    value: function read() {
      readDeprecationWarning();
      return this.readFlo.apply(this, arguments);
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFlo.path);
      return this.makeRequest('GET', endpoint).asCallback(cb);
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
     * // data should be taken from on your on demand flos
     * // In that case the client allows you to specify where the params will end up
     * var data = {
     *  headers : {
     *    'this data': 'will be attached as additional headers'
     *  },
     *  query : {
     *    'this data': 'will be converted to a query string and appended to the URL'
     *  },
     *  body : {
     *    'and this data': 'will be send in the body'
     *  }
     *  'any additional data': 'will also be send in the body object'
     * }
     * // Invokes a flo with given data
     * azuqua.invoke('exampleFloAlias', {'name': 'Azuqua'}).then(function(response) {
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.invoke.path);
      return this.makeRequest('POST', endpoint, params).asCallback(cb);
    }

    /*
     * Resumes a flo with the given execution id
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {string} exec - The flo execution id
     * @param {object} params - An object containing the params needed to invoke the flo
     * @param {azuquaCallback} [cb] - Callback function that handles the invoke response
     */

  }, {
    key: 'resume',
    value: function resume(flo, exec, params, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.invoke.path).replace(':exec', exec);
      return this.makeRequest('POST', endpoint, params).asCallback(cb);
    }

    /**
     * Injects data into a flo with the given parameter information
     * @example
     * // Injects a flo with given data
     * azuqua.inject('exampleFloAlias', {'name': 'Azuqua'}).then(function(response) {
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.inject.path);
      return this.makeRequest('POST', endpoint, params).asCallback(cb);
    }

    /**
     * Enables a flo (Turns on)
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.enable.path);
      return this.makeRequest('POST', endpoint).asCallback(cb);
    }

    /**
     * Disables a flo (Turns off)
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.disable.path);
      return this.makeRequest('POST', endpoint).asCallback(cb);
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
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.inputs.path);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * Read the outputs of a particular flo
     * @example
     * // Reads the outputs of a flo
     * azuqua.outputs('exampleFloAlias').then(function(outputs) {
     *  // Do something with output data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles the outputs response
     */

  }, {
    key: 'outputs',
    value: function outputs(flo, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.outputs.path);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * Read the swaggerDefinition of a particular flo
     * @example
     * // Reads the swaggerDefinition of a flo
     * azuqua.swaggerDefinition('exampleFloAlias').then(function(outputs) {
     *  // Do something with swaggerDefinition
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {Flo|string} flo - The flo object or alias of a flo
     * @param {azuquaCallback} [cb] - Callback function that handles the swaggerDefinition response
     */

  }, {
    key: 'swaggerDefinition',
    value: function swaggerDefinition(flo, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.swaggerDefinition.path);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * @example
     * // Retrieves the org id, name, and associated groups that the azuqua user belongs to
     * azuqua.groups('exampleFloAlias').then(function(groups) {
     *  // Do something with group data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * Returns an array of org and group data related to the particular user
     * @param {azuquaCallback} [cb] - Callback function that handles the groups response
     */

  }, {
    key: 'groups',
    value: function groups(params, cb) {
      return this.makeRequest('GET', Azuqua.routes.groups.path, { query: params }).asCallback(cb);
    }

    /**
     * @example
     * // Read IO telemetry data for each step in a flo execution sorted by the execution order;
     * azuqua.readFloExecutionTelemetry('exampleFloAlias', 'exampleFloExec').then(function(data) {
     *  // Do something with execution data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {azuquaCallback} [cb] - Callback function that handles the telemetry response
     */

  }, {
    key: 'readFloExecutionTelemetry',
    value: function readFloExecutionTelemetry(flo, exec, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFloExecutionTelemetry.path).replace(':exec', exec);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * @example
     * // Read computed metrics about a flo execution such as latency between components and latency per step
     * azuqua.readFloExecutionMetrics('exampleFloAlias', 'exampleFloExec').then(function(data) {
     *  // Do something with execution data
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {azuquaCallback} [cb] - Callback function that handles the telemetry response
     */

  }, {
    key: 'readFloExecutionMetrics',
    value: function readFloExecutionMetrics(flo, exec, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFloExecutionMetrics.path).replace(':exec', exec);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * @example
     * // Reads past executions of a flo
     * azuqua.readFloExecutionTelemetry('exampleFloAlias').then(function(data) {
     *  // Do something past executions
     * }).catch(function(error) {
     *  // Handle the error
     *  console.log('Error: ', error);
     * })
     * @param {azuquaCallback} [cb] - Callback function that handles the telemetry response
     */

  }, {
    key: 'readFloPastExecutions',
    value: function readFloPastExecutions(flo, cb) {
      var endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFloPastExecutions.path);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * Create an Azuqua rule
     * @example
     * var rule = {
     *   'conditions': {
     *     'identifiers': [],
     *     'expr': 'avg(.data.outside.temp) > 30 and .data.humidity < 20',
     *     'scope': {
     *       'type': 'org',
     *       'id': '[org_id_here]',
     *       'clauses': []
     *     },
     *     'id': my_id
     *   },
     *   'org_id': my_org_id,
     *   'user_id': my_id,
     *   'partner_id': my_partner_id,
     *   'active': true,
     *   'policy': 'placeholder-policy'
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
      return this.makeRequest('POST', '/rule', { rule: rule }).asCallback(cb);
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
      var endpoint = Azuqua.routes.readRule.path.replace(':id', id);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * Update an Azuqua rule
     * @example
     * var rule = {
     *   'conditions': {
     *     'expr': 'avg(.data.inside.temp) < 50',
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
      var endpoint = Azuqua.routes.updateRule.path.replace(':id', id);
      return this.makeRequest('PUT', endpoint, { rule: rule }).asCallback(cb);
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
      var endpoint = Azuqua.routes.readAllRules.path;
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * Deletes an Azuqua rule
     * @example
     * // Deletes a rule
     * azuqua.deleteRule(rule_id).then(function(rule) {
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
      var endpoint = Azuqua.routes.deleteRule.path.replace(':id', id);
      return this.makeRequest('DELETE', endpoint).asCallback(cb);
    }

    /**
     * Links a rule and flo
     * @example
     * Links a Azuqua rule to a flo by each respective ID
     * // Links a rule to a flo and returns the rule
     * azuqua.linkRuleAndFlo(rule_id, flo_id).then(function(rule) {
     *  // Do something with response (Rule was linked)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} ruleId - The ID of the rule to link
     * @param {integer} floId - The ID of the flo to link
     * @param {azuquaCallback} [cb] - Callback function that handles the linkRuleAndFlo response
     */

  }, {
    key: 'linkRuleAndFlo',
    value: function linkRuleAndFlo(ruleId, floId, cb) {
      var endpoint = Azuqua.routes.linkRuleAndFlo.path.replace(':ruleId', ruleId).replace(':floId', floId);
      return this.makeRequest('POST', endpoint).asCallback(cb);
    }

    /**
     * Gets meta information about connectors in an org
     * @example
     * // Gets meta information about connectors an org has access to
     * azuqua.connectors(orgId).then(function(connectors) {
     *  // Do something with response (Array of connectors)
     * }).catch(function(error) {
     *  // Handle error
     *  console.log('Error: ', error);
     * })
     * @param {integer} orgId - The ID (of an org you belong to) of the org to read
     * @param {azuquaCallback} [cb] - Callback function that handles the response
     */

  }, {
    key: 'getOrgConnectors',
    value: function getOrgConnectors(orgId, cb) {
      var endpoint = Azuqua.routes.getOrgConnectors.path.replace(':orgId', orgId).replace(':orgId', orgId);
      return this.makeRequest('GET', endpoint).asCallback(cb);
    }

    /**
     * A generic function that allows request to arbitrary routes. Handles building the headers before sending the request
     * @example
     * // Make a generic request to an azuqua api - signing the request with proper headers
     * azuqua.makeRequest('GET', 'flo/randomaliashere/invoke', {name: 'Azuqua', location: 'Seattle'})
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
      var _params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      // This method trys to be smart about params passed to build the request
      // So it will look at params, and the HTTP Method to determine how it should build the hash
      // _params is an object in the same format that the HTTP endpoint flo get's it's data
      // AKA - An option body, header and query sub object with any top level data being passed in the HTTP body
      if (!this.account.accessKey || !this.account.accessSecret) {
        return Promise.reject(new Error('Account information not provided'));
      }

      var route = _path;
      var params = _extends({}, _params);
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
        body = ''; // API DOESN'T ACCEPT GET WITH BODIES
      } else {
        data = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
        body = data;
      }

      // Append query information to end of url
      if (Object.keys(query).length > 0) {
        route = route + '?' + querystring.stringify(query);
      }

      var authHeaders = Azuqua.generateHeaders(method, route, this.account.accessKey, this.account.accessSecret, data);
      if (_.isError(authHeaders)) {
        throw authHeaders;
      }

      var requestUrl = this.protocol + '://' + this.httpOptions.host + ':' + this.httpOptions.port + route;

      // The .then basically triggers the error handler on our flo methods
      return Promise.resolve(fetch(requestUrl, {
        method: method,
        headers: _extends({}, headers, authHeaders),
        body: body
      })).then(checkResponseError).then(toJSON).catch(errorHandler);
    } // End make request method

    /**
     * Loads the config at _path into azuqua instance's account settings
     * @example
     * // Create 'empty' azuqua instance
     * var azuqua = new Azuqua();
     * // Load config from location
     * azuqua.loadConfig('./path/to/config.js');
     * // azuqua instance now property configured
     * @param {string} _path - The path of the config file
     */

  }, {
    key: 'loadConfig',
    value: function loadConfig(_path) {
      // Resolve the config path from the requiring parent's location if it's relative
      var configPath = path.resolve(path.dirname(module.parent.filename), _path);
      this.account = require(configPath);
    }
  }], [{
    key: 'generateHeaders',


    /**
     * A static function that generates the headers for a particular request
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
    value: function generateHeaders(method, path, accessKey, accessSecret, data) {
      // Default params don't override null and we can't send null data
      if (!data) {
        data = '';
      }

      if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
        data = JSON.stringify(data);
      }

      var pathQueryString = void 0;
      if (method === 'GET' || method === 'DELETE') {
        pathQueryString = data || '';
        if (!_.isEmpty(pathQueryString)) {
          try {
            var pathQueryStringHolder = JSON.parse(pathQueryString);
            // The query string has all values in string form when it hits the server
            // So id=833 would need to be id='833' when calculating the hash
            // This might need changing (If for some reason people are passing in nested...
            // objects in their query strings
            pathQueryStringHolder = _.mapValues(pathQueryStringHolder, function (value) {
              return value.toString();
            });
            pathQueryString = JSON.stringify(pathQueryStringHolder, null, 0);
          } catch (e) {
            var errProxy = new Error('Error mapping query string to string values');
            throw errProxy;
          }
        }
      } else {
        pathQueryString = data || '{}';
      }

      var timestamp = new Date().toISOString();

      var meta = [method.toLowerCase(), path, timestamp].join(':') + pathQueryString;
      var hash = crypto.createHmac('sha256', accessSecret).update(Buffer.from(meta, 'utf-8')).digest('hex');

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
      return routes;
    } // End of route declarations

  }]);

  return Azuqua;
}(); // End of Azuqua class declaration

///**
// * Class representing a Flo instance
// * @property {String}  id             - ID for the flo.
// * @property {String}  alias          - Alias of the flo.
// * @property {String}  name           - Name of the flo.
// * @property {String}  version        - Version of the flo.
// * @property {Boolean} active         - Value indicating whether a flo has turned on.
// * @property {Boolean} published      - Value indicating whether a flo has been published or not.
// * @property {String}  security_level - Security level access for a flo.
// * @property {String}  client_token   - Client Token for a flo.
// * @property {String}  description    - Flo's description.
// * @property {Date}    created
// * @property {Date}    updated
// * */


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