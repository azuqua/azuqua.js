'use strict';

// Standard Lib modules
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const routes = require('../static/routes');
const FormData = require('form-data');
const stream = require('stream');

// External modules
const Promise = require('bluebird');
const _ = require('lodash');

const defaultRequestOptions = { 
  asJSON: true,
  errorOnStatusCode: true,
  onlyBody: true 
};

function request(httpOptions, options) {
  return new Promise((resolve, reject) => {
    const { host, port, protocol } = httpOptions;
    const { path, verb, headers, body } = options;
    const client = protocol === 'https' ? https : http;

    const requestOptions = {
      hostname: host,
      port: port,
      method: verb,
      path: path,
      headers: headers
    };

    const req = client.request(requestOptions, (res) => {
      res.body = '';
      res.on('data', (d) => {
        res.body = res.body + d;
      });

      res.on('end', (e) => {
        resolve(res);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body instanceof stream.Readable) {
      body.pipe(req);
    } else {
      if (verb === 'post' || verb === 'put') {
        req.write(body);
      }
      req.end();
    }
  });
}

// Throw an error on > 400 level status codes
function requestThrowStatusCode(res) {
  if (res.statusCode >= 400) {
    let errProxy = new Error('Response sent error level status code');
    errProxy.res = res; throw errProxy;
  }
  return res;
}

// Write over the body of the response with a JSON.parse version
function requestParseJSON(res) {
  res.body = JSON.parse(res.body);
}

// Return only the body of the response
function requestOnlyBody(res) {
  return _.get(res, 'body');
}

// Helper function to read file and create hash of it
// Returns a tuple of hash/unread stream
function formDataToHashAndStream(formPassThrough) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    // Create a initial stream since FormData doesn't appear to like being forked
    const hashReadStream = formPassThrough.pipe(new stream.PassThrough());
    const unreadReadStream = formPassThrough.pipe(new stream.PassThrough());

    hashReadStream.on('data', (data) => {
      hash.update(data);
    });
    hashReadStream.on('end', () => {
      return resolve([hash.digest('hex'), unreadReadStream]);
    });
    hashReadStream.on('error', (error) => {
      return reject(error);
    });
  });
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
   * @param {object} config - Config object to configure your azuqua instace
   * @param {string} config.accessKey - The access key associated with the Azuqua account
   * @param {string} config.accessSecret - The access secret associated with the Azuqua account
   * @param {object} [config.httpOptions] - An httpOptions object to override default httpOptions
   */
  constructor(config) {
    // Default Properties
    this.account = {
      accessKey: _.get(config, 'accessKey'),
      accessSecret: _.get(config, 'accessSecret')
    };

    this.protocol = 'https';
    this.httpOptions = _.extend({
      host: 'api.azuqua.com',
      port: 443,
      protocol: 'https'
    }, _.get(config, 'httpOptions', {}));

    // Finally set protocol
    this.protocol = this.httpOptions.port === 443 ? 'https' : 'http';

    Object.freeze(this.httpOptions);

    // Build routes
    this.buildRoutes();
  }

  static newFromEnv(config) {
    if (process.env.AZUQUA_ACCESS_KEY) {
      config.accessKey = process.env.AZUQUA_ACCESS_KEY;
    }
    if (process.env.AZUQUA_ACCESS_SECRET) {
      config.accessSecret = process.env.AZUQUA_ACCESS_SECRET;
    }
    if (!config.accessKey || !config.accessSecret) {
      throw new Error('Missing AZUQUA_ACCESS_KEY or AZUQUA_ACCESS_SECRET in environment');
    }
    return new Azuqua(config);
  }

  buildRoutes() {
    const azuqua = this;
    _.forOwn(routes, (group) => {
      _.forOwn(group, (route, routeName) => {
        const method = _.toUpper(_.head(_.get(route, 'methods')));
        const path = _.get(route, 'path');
        const params = path.split('/').filter(part => String(part).startsWith(':'));
        routeName = _.camelCase(routeName);
        this[routeName] = function() {
          if (arguments.length < params.length) {
            throw new Error(`Expected at least ${params.length} arguments`);
          }
          let newPath = path;
          params.forEach((param, idx) => {
            newPath = newPath.replace(param, arguments[idx])
          });
          let data = {};
          if (method === 'POST' || method === 'PUT' && arguments.length > params.length) {
            if (_.isPlainObject(arguments[arguments.length - 1])) {
              data = arguments[arguments.length - 1];
            }
          }
          return azuqua.makeRequest(method, newPath, data, defaultRequestOptions);
        }
      });
    });
  }

  invoke(alias, data) {
    const { 
      query = {},
      headers = {},
      body = {},
      files = {}
    } = data;
    const verb = String(data.verb || 'post').toLowerCase();
    const timestamp = (new Date()).toISOString();

    // Create path
    let path = `/v2/flo/${alias}/invoke`;
    let queryString = '';
    if (!_.isEmpty(query)) {
      let queryString = querystring.stringify(query);
      path = path + '?' + queryString;
    }

    const requestHeaders = _.extend({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-accesskey' : this.account.accessKey,
      'x-api-timestamp' : timestamp,
    }, headers);

    let bodyHashInput;
    let bodyData;
    return Promise.resolve()
      .then(() => {
        const filesPresent = _.isPlainObject(files) && !_.isEmpty(files);
        if (filesPresent || headers['Content-Type'] === 'multipart/form-data') {
          const form = new FormData();

          // Add body then files to request body
          Object.keys(body)
            .forEach(bodyFieldName => {
              form.append(bodyFieldName, body[bodyFieldName]);
            });
          Object.keys(files)
            .forEach(fileFieldName => {
              form.append(fileFieldName, files[fileFieldName]);
            });

          // Add headers to request
          _.extend(requestHeaders, form.getHeaders());

          const formPassThrough = new stream.PassThrough();
          form.pipe(formPassThrough);

          return formDataToHashAndStream(formPassThrough)
            .spread((hash, stream) => {
              bodyHashInput = hash;
              bodyData = stream;
              return '';
            });
        } else {
          bodyHashInput = bodyData = _.isEmpty(body) ? '' : JSON.stringify(body);
          return '';
        }
      })
      .then(() => {
        let meta = [verb, path, timestamp].join(':') + bodyHashInput;
        let hash = crypto.createHmac('sha256', this.account.accessSecret)
          .update(new Buffer(meta, 'utf-8'))
          .digest('hex');

        requestHeaders['x-api-hash'] = hash;

        const requestOptions = {
          verb,
          path,
          headers: requestHeaders,
          body: bodyData
        };
        return request(this.httpOptions, requestOptions)
      })
      .then(res => {
        res = requestOnlyBody(res);
        return res;
      })
      .catch(e => {
        let body = requestOnlyBody(e.res);
        let errProxy = new Error('Response sent error level status code');
        errProxy.body = body;
        throw errProxy;
        throw e;
      });
  }

  // Helper function for requesting arbitrary Azuqua endpoints
  makeRequest(verb, path, data, options = {}) {
    if (!this.account.accessKey || !this.account.accessSecret) {
      return Promise.reject(new Error('Account information not provided'));
    }
    const { asJSON, errorOnStatusCode, onlyBody } = options;

    verb = verb.toLowerCase();
    let headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    let body = '';

    if (verb === 'get' || verb === 'delete') {
      let queryString = '';
      if (!_.isEmpty(data)) {
        let queryString = querystring.stringify(data);
        path = path + '?' + queryString;
      }
    } else {
      body = _.isEmpty(data) ? '' : JSON.stringify(data);
    }

    let authHeaders = Azuqua.generateHeaders(verb, path, this.account.accessKey, this.account.accessSecret, body);
    if (_.isError(authHeaders)) {
      throw authHeaders;
    }
    _.extend(headers, authHeaders);

    const requestOptions = {
      verb,
      path,
      headers,
      body
    };

    return request(this.httpOptions, requestOptions)
      .then(res => {
        // Handle options that impact res
        if (asJSON) {
          requestParseJSON(res);
        }
        if (errorOnStatusCode) {
          requestThrowStatusCode(res);
        }
        if (onlyBody) {
          res = requestOnlyBody(res);
        }
        return res;
      })
      .catch(e => {
        if (onlyBody) {
          let body = requestOnlyBody(e.res);
          let errProxy = new Error('Response sent error level status code');
          errProxy.body = body;
          throw errProxy;
        }
        throw e;
      });

  } // End make request method

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
  static generateHeaders(verb, path, accessKey, accessSecret, data) {
    let timestamp = new Date().toISOString();

    let meta = [verb, path, timestamp].join(':') + data;
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

module.exports = Azuqua;
