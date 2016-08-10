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

// Use bluebird for promises
fetch.Promise = Promise;

const paramRegex = /:\w+/;

/**
 * `AzuquaCallback`
 * @callback azuquaCallback
 * @param {object} Error - An error object containing information about the error
 * @param {object} Response - A response object containing relevant response information
 */

function checkResponseError(response) {
  if (response.status < 200 || response.status >= 400) {
    return response.json()
      .then((json) => {
        throw json;
      });
  } else {
    return response;
  }
};

function toJSON(response) {
  return response.json();
}

function errorHandler(error) {
  if (error.name === 'FetchError') {
    let formattedError = new Error('Error reaching requested resource');
    formattedError.name = 'Request Error';
    throw formattedError;
  } else {
    throw error;
  }
}

function handleErrorCallback(cb) {
  return function(error) {
    cb(error, null);
  };
}

/** Class representing an Azuqua instance */
class Azuqua {
  /**
   * Creates an azuqua instance with given Access Key and Access Secret
   * @constructor
   * @param {string} accessKey - The access key associated with the Azuqua account
   * @param {string} accessSecret - The access secret associated with the Azuqua account
   * @param {object} [httpOptions] - An httpOptions object to override default httpOptions
   */
  constructor(accessKey, accessSecret, httpOptions) {
      // Properties
    this.account = {};
    this.account.accessKey = undefined;
    this.account.accessSecret = undefined;

    // Cached Flos
    this._flos = null;

    if(process.env.ACCESS_KEY) {
      this.account.accessKey = process.env.ACCESS_KEY;
    }
    if(process.env.ACCESS_SECRET) {
      this.account.accessSecret = process.env.ACCESS_SECRET;
    }
    if(typeof accessKey === 'string') {
      this.account.accessKey = accessKey;
    }
    if(typeof accessSecret === 'string') {
      this.account.accessSecret = accessSecret;
    }

    this.protocol = 'https';
    this.httpOptions = {
      host: 'api.azuqua.com',
      port: 443
    };

    if (typeof httpOptions === 'object') {
      this.httpOptions = {
        ...this.httpOptions,
        ...httpOptions
      };
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
  flos(force, cb) {
    if (typeof force === 'function') {
      cb = force;
      force = false;
    } else if (typeof force !== 'function' && typeof cb !== 'function') {
      return Promise.promisify(this.flos).bind(this)(force);
    }
    if (!force && this._flos !== null) {
      return cb(null, this._flos);
    } 
    this.makeRequest('GET', Azuqua.routes.flos.path, {})
      .then((json) => {
        this._flos = json.map((flo) => new Flo(flo));
        cb(null, this._flos);
      }).catch((error) => {
        cb(error, null);
      });
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
  read(flo, cb) {
    if (typeof cb !== 'function') {
      return Promise.promisify(this.read).bind(this)(flo);
    }
    let alias = typeof flo === 'string' ? flo : flo.alias;
    let params = { alias : alias };
    this.makeRequest('GET', '/flo/:alias/read', params)
      .then((json) => {
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
  invoke(flo, params, cb) {
    if (typeof cb !== 'function') {
      return Promise.promisify(this.invoke).bind(this)(flo, params);
    }
    let alias = typeof flo === 'string' ? flo : flo.alias;
    params.alias = alias;
    this.makeRequest('POST', Azuqua.routes.invoke.path, params)
      .then((json) => {
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
  inputs(flo, cb) {
    if (typeof cb !== 'function') {
      return Promise.promisify(this.inputs).bind(this)(flo);
    }
    let alias = typeof flo === 'string' ? flo : flo.alias;
    let params = {};
    params.alias = alias;
    this.makeRequest('GET', Azuqua.routes.inputs.path, params)
      .then((json) => {
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
  groups(cb) {
    if (typeof cb !== 'function') {
      return Promise.promisify(this.groups).bind(this)();
    }
    this.makeRequest('GET', 'user/orgs', {})
      .then((json) => {
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
  makeRequest(_method, _path, _params = {}) {
    if (!this.account.accessKey || !this.account.accessSecret) {
      return Promise.reject(new Error('Account information not provided'));
    }

    let route = null;
    let method = _method.toUpperCase();
    let headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    let data = null;
    
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
    let urlRegex = /:\w+/;
    let formattedUrl = url.parse(_path).format();
    let urlComponents = formattedUrl.split('/');
    for (let component of urlComponents) {
      if (urlRegex.test(component)) {
        let name = component.substring(1);
        let replacement = _params[name];
        if (!replacement) {
          return Promise.reject('Mismatch between url params and passed params');
        } else {
          formattedUrl = formattedUrl.replace(component, replacement);
            // Not sure if we need this
          delete _params[name];
        }
      }
    }
    route = formattedUrl + (Object.keys(_.omit(_params, ['data'])).length > 0 ? 
            '?' + querystring.stringify(_.omit(_params, ['data'])) : '');

    let authHeaders = Azuqua.generateHeaders(method, route, this.account.accessKey, 
        this.account.accessSecret, _params);

    let requestUrl = `${this.protocol}://${this.httpOptions.host}:${this.httpOptions.port}${route}`;

    // The .then basically triggers the error handler on our flo methods
    return fetch(requestUrl, {
      method: method,
      headers : {
        ...headers,
        ...authHeaders
      },
      body : data
    }).then(checkResponseError).then(toJSON).catch(errorHandler);
  } // End make request method

  loadConfig (_path) {
    // Resolve the config path from the requiring parent's location if it's relative
    _path = path.resolve(path.dirname(module.parent.filename), _path);
    this.account = require(_path);
  };

  loadConfigAsync (_path, cb) {
    _path = path.resolve(path.dirname(module.parent.filename), _path);
    fs.readFile(_path, (error, data) => {
      if (error) {
        cb(error, null);
      } else {
        try {
          let config = JSON.parse(data);
          this.account = config;
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
  static generateHeaders(method, path, accessKey, accessSecret, params = '') {
    // Default params don't override null and we can't send null data
    let data = params ? params.data : '';
    if (!data) {
      data = '';
    }

    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }

    let pathQueryString;
    if (method === 'GET') {
      let queryObject = url.parse(path, true).query;
      if (Object.keys(queryObject).length > 0) {
        pathQueryString = JSON.stringify(queryObject);
      } else {
        pathQueryString = '';
      }
    } else {
      pathQueryString = data || '{}';
    }

    let timestamp = new Date().toISOString();

    let meta = [method.toLowerCase(), path, new Date().toISOString()].join(':') + pathQueryString;
    let hash = crypto.createHmac('sha256', accessSecret).update(new Buffer(meta, 'utf-8')).digest('hex');

    return {
      'x-api-hash' : hash,
      'x-api-accesskey' : accessKey,
      'x-api-timestamp' : timestamp
    };
  } // End of generateHeaders

  // Declare routes
  static get routes() {
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

} // End of Azuqua class declaration

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