'use strict';

// Standard Lib modules
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// External modules
const Promise = require('bluebird');
const _ = require('lodash');

// Local Requires
// Explination: Conditionally load routes try local but if run from src, load from another path
// const routes = require('../static/routes');

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

    const req = https.request(requestOptions, (res) => {
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

    if (verb === 'post' || verb === 'put') {
      req.write(body);
    }
    req.end();
  });
}

function requestThrowStatusCode(res) {
  if (res.statusCode >= 400) {
    let errProxy = new Error('Response sent error level status code');
    errProxy.res = res;
    throw errProxy;
  }
  return res;
}

function requestParseJSON(res) {
  res.body = JSON.parse(res.body);
}

function requestOnlyBody(res) {
  return _.get(res, 'body');
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
      port: 443
    }, _.get(config, 'httpOptions', {}));

    // Finally set port
    this.protocol = this.httpOptions.port === 443 ? 'https' : 'http';

    Object.freeze(this.httpOptions);
  } // End of constructor

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

  // Group Functions
  createGroup(data) {
    return this.makeRequest('post', `/v2/group`, data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  readGroup(id) {
    return this.makeRequest('get', `/v2/group/${id}`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  updateGroup(id, data) {
    return this.makeRequest('put', `/v2/group/${id}`, data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  deleteGroup(id) {
    return this.makeRequest('delete', `/v2/group/${id}`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  attachFloToGroup(groupId, floId) {
    return this.makeRequest('post', `/v2/group/${groupId}/attach/flo/${floId}`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  attachUserToGroup(groupId, userId) {
    return this.makeRequest('post', `/v2/group/${groupId}/attach/user/${userId}`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  // Org Functions
  readOrg(id) {
    return this.makeRequest('get', `/v2/org/${id}`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  updateOrg(id, data) {
    return this.makeRequest('put', `/v2/org/${id}`, data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  readOrgFlos(id, data) {
    return this.makeRequest('get', `/v2/org/${id}/flos`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  readOrgConnectors(id, data) {
    return this.makeRequest('get', `/v2/org/${id}/connectors`, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
  }

  inviteUserToOrg(id, email, message = 'You have been invited to an Azuqua Org!') {
    return this.makeRequest('post', `/v2/org/${id}/invite`, { email, message }, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
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
