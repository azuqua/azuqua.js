'use strict';

// Standard Lib modules
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

// External modules
const fetch = require('node-fetch');
const Promise = require('bluebird');
const _ = require('lodash');

// Local Requires
// Explination: Conditionally load routes try local but if run from src, load from another path
const routes = require('../static/routes');
const readDeprecationWarning = _.once(() => console.log('Read is deprecated. Please use readFlo instead'));

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
    return response.text()
      .then((text) => {
        try {
          let responseJson = JSON.parse(text);
          throw responseJson;
        } catch (e) {
          let errProxy = { error : text };
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
  return response.text()
    .then(text => {
      try {
        let responseJson = JSON.parse(text);
        return Promise.resolve(responseJson);
      } catch (e) {
        let errProxy = new Error(`Error trying to parse the following server response as JSON: ${text}`)
        errProxy.type = 'ResponseParsingError';
        throw errProxy;
      }
    }) 
}

// errorHandler for network/fetch errors. Provides a bit more information to the user
function errorHandler(error) {
  if (error.name === 'FetchError') {
    let errProxy = new Error(`Failed to reach requested resource (${error.code})`);
    errProxy.type = 'FetchError';
    throw errProxy;
  } else {
    let errProxyObject = _.extend({}, error);
    if (_.isNil(errProxyObject.name)) {
      errProxyObject.name = `Request Error`;
    }
    if (_.isNil(errProxyObject.message)) {
      errProxyObject.message = `There was an error in the request process. ${JSON.stringify(error)}.`;
    }
    throw errProxyObject;
  }
}

// Helper function that will format the desired endpoint for the flo's alias
function makeAliasEndpoint(flo, endpoint) {
  let alias = typeof flo === 'string' ? flo : flo.alias;
  let endpointWithAlias = endpoint.replace(':alias', alias); 
  return endpointWithAlias;
}

/** Class representing an Azuqua instance */
class Azuqua {
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
  constructor(accessKey, accessSecret, httpOptions) {
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
      if (arguments.length === 1 && typeof arguments[0] === 'object') {
        // If we have an argument it should be http options
        this.httpOptions = {
          ...this.httpOptions,
          ...httpOptions
        };
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

      if (typeof httpOptions === 'object') {
        this.httpOptions = {
          ...this.httpOptions,
          ...httpOptions
        };
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
  flos(force, params, cb) {
    return this.makeRequest('GET', '/account/flos', { query : params })
      .then((json) => {
        this._flos = json.map((flo) => new Flo(flo));
        return json;
      })
      .asCallback(cb);
  } 

  read(...args) {
    readDeprecationWarning();
    return this.readFlo(...args);
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
  readFlo(flo, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.readFlo.path);
    return this.makeRequest('GET', endpoint)
      .asCallback(cb);
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
  invoke(flo, params, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.invoke.path);
    return this.makeRequest('POST', endpoint, params)
      .asCallback(cb);
  }

  /*
   * Resumes a flo with the given execution id
   * @param {Flo|string} flo - The flo object or alias of a flo
   * @param {string} exec - The flo execution id
   * @param {object} params - An object containing the params needed to invoke the flo
   * @param {azuquaCallback} [cb] - Callback function that handles the invoke response
   */
  resume(flo, exec, params, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.invoke.path).replace(':exec', exec);
    return this.makeRequest('POST', endpoint, params)
      .asCallback(cb);
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
  inject(flo, params, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.inject.path);
    return this.makeRequest('POST', endpoint, params)
      .asCallback(cb);
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
  enable(flo, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.enable.path);
    return this.makeRequest('POST', endpoint)
      .asCallback(cb);
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
  disable(flo, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.disable.path);
    return this.makeRequest('POST', endpoint)
      .asCallback(cb);
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
  inputs(flo, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.inputs.path);
    return this.makeRequest('GET', endpoint)
      .asCallback(cb);
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
  outputs(flo, cb) {
    let endpoint = makeAliasEndpoint(flo, Azuqua.routes.outputs.path);
    return this.makeRequest('GET', endpoint)
      .asCallback(cb);
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
  groups(params, cb) {
    return this.makeRequest('GET', Azuqua.routes.groups.path, { query : params })
      .asCallback(cb);
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
  createRule(rule, cb) {
    return this.makeRequest('POST', '/rule', { rule : rule })
      .asCallback(cb);
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
  readRule(id, cb) {
    let endpoint =  Azuqua.routes.readRule.path.replace(':id', id);
    return this.makeRequest('GET', endpoint)
      .asCallback(cb);
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
  updateRule(id, rule, cb) {
    let endpoint =  Azuqua.routes.updateRule.path.replace(':id', id);
    return this.makeRequest('PUT', endpoint, { rule : rule })
      .asCallback(cb);
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
  readAllRules(cb) {
    let endpoint =  Azuqua.routes.readAllRules.path;
    return this.makeRequest('GET', endpoint)
      .asCallback(cb);
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
  deleteRule(id, cb) {
    let endpoint =  Azuqua.routes.deleteRule.path.replace(':id', id);
    return this.makeRequest('DELETE', endpoint)
      .asCallback(cb);
  }

  /**
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
  linkRuleAndFlo(ruleId, floId, cb) {
    let endpoint =  Azuqua.routes.linkRuleAndFlo.path.replace(':ruleId', ruleId).replace(':floId', floId);
    return this.makeRequest('POST', endpoint)
      .asCallback(cb);
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
  makeRequest(_method, _path, _params = {}) {
    // This method trys to be smart about params passed to build the request
    // So it will look at params, and the HTTP Method to determine how it should build the hash
    // _params is an object in the same format that the HTTP endpoint flo get's it's data
    // AKA - An option body, header and query sub object with any top level data being passed in the HTTP body
    if (!this.account.accessKey || !this.account.accessSecret) {
      return Promise.reject(new Error('Account information not provided'));
    }

    let route = _path;
    let params = {
      ..._params
    };
    let method = _method.toUpperCase();
    let headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    let query = {};
    let body = {};

    // Take information about of params and place it in respective place
    if (params.query) {
      if (typeof params.query === 'object') {
        query = params.query;
      } 
      delete params.query;
    }
    if (params.headers) {
      if (typeof params.headers === 'object') {
        _.extend(headers, params.headers);
      }
      delete params.headers;
    }
    if (params.body) {
      if (typeof params.body === 'object') {
        body = params.body;
      }
      delete params.body;
    }
    _.extend(body, params);

    // Represents the data that will be hashed (Which is why we stringify it)
    let data = null;

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
 

    let authHeaders = Azuqua.generateHeaders(method, route, this.account.accessKey, this.account.accessSecret, data);
    if (_.isError(authHeaders)) {
      throw authHeaders;
    }

    let requestUrl = `${this.protocol}://${this.httpOptions.host}:${this.httpOptions.port}${route}`;

    // The .then basically triggers the error handler on our flo methods
    return Promise.resolve(fetch(requestUrl, {
      method: method,
      headers : {
        ...headers,
        ...authHeaders,
      },
      body : body
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
  loadConfig (_path) {
    // Resolve the config path from the requiring parent's location if it's relative
    let configPath = path.resolve(path.dirname(module.parent.filename), _path);
    this.account = require(configPath);
  };

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
  static generateHeaders(method, path, accessKey, accessSecret, data) {
    // Default params don't override null and we can't send null data
    if (!data) {
      data = '';
    }

    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }

    let pathQueryString;
    if (method === 'GET' || method === 'DELETE') {
      pathQueryString = data || '';
      if (!_.isEmpty(pathQueryString)) {
        try {
          let pathQueryStringHolder = JSON.parse(pathQueryString);
          // The query string has all values in string form when it hits the server
          // So id=833 would need to be id='833' when calculating the hash
          // This might need changing (If for some reason people are passing in nested...
          // objects in their query strings
          pathQueryStringHolder = _.mapValues(pathQueryStringHolder, (value) => {
            return value.toString();
          });
          pathQueryString = JSON.stringify(pathQueryStringHolder, null, 0);
        } catch(e) { 
          let errProxy = new Error('Error mapping query string to string values');
          throw errProxy;
        }
      }
    } else {
      pathQueryString = data || '{}';
    }

    let timestamp = new Date().toISOString();

    let meta = [method.toLowerCase(), path, timestamp].join(':') + pathQueryString;
    let hash = crypto.createHmac('sha256', accessSecret).update(Buffer.from(meta, 'utf-8')).digest('hex');

    return {
      'x-api-hash' : hash,
      'x-api-accesskey' : accessKey,
      'x-api-timestamp' : timestamp
    };
  } // End of generateHeaders

  // Declare routes
  static get routes() {
    return routes;
  } // End of route declarations

} // End of Azuqua class declaration

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
class Flo {
  /**
   * Creates a Flo instance with given Flo data
   * @constructor
   * @param {Object} floObject - Object containing the data to build the flo with
   */
  constructor(floObject) {
    _.extend(this, floObject);
  }
}

module.exports = Azuqua;
