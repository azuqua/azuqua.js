'use strict';

const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');
const fetch = require('node-fetch');
const Promise = require('bluebird');
const _ = require('lodash');
// Use bluebird for promises
fetch.Promise = Promise;

const paramRegex = /:\w+/;

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

class Azuqua {
  // Constructor
  constructor(accessKey, accessSecret, httpOptions) {
      // Properties
    this.account = {};
    this.account.accessKey = null;
    this.account.accessSecret = null;

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

  // (Get) Flos method
  flos(cb) {
    this.makeRequest('GET', Azuqua.routes.flos.path, {})
      .then((json) => {
        cb(null, json);
      }).catch((error) => {
        cb(error, null);
      });
  } // End get flos method

  // Invoke flos method
  invoke(flo, params, cb) {
    let alias = typeof flo === 'string' ? flo : flo.alias;
    params.alias = alias;
    this.makeRequest('POST', Azuqua.routes.invoke.path, params)
      .then((json) => {
        cb(null, json);
      }).catch((error) => {
        cb(error, null);
      });
  }

  // Make request method
  makeRequest(_method, _path, _params) {
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

    // console.log(requestUrl, {
    //   method: method,
    //   headers : {
    //     ...headers,
    //     ...authHeaders
    //   },
    //   body : data
    // });

    // The .then basically triggers the error handler on our flo methods
    return fetch(requestUrl, {
      method: method,
      headers : {
        ...headers,
        ...authHeaders
      },
      body : data
    }).then(checkResponseError).then(toJSON);
  } // End make request method




  // Start generateHeaders method
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
      };
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

class Flo {
  constructor(floObject) {
    this.flo = floObject;
    this.alias = floObject.alias;
  }
}

module.exports = Azuqua;