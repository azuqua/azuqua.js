'use strict';

// Standard Lib modules

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var url = require('url');
var crypto = require('crypto');
var querystring = require('querystring');
var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

// External modules
var Promise = require('bluebird');
var _ = require('lodash');

// Local Requires
// Explination: Conditionally load routes try local but if run from src, load from another path
// const routes = require('../static/routes');

function request(httpOptions, options) {
  return new Promise(function (resolve, reject) {
    var host = httpOptions.host,
        port = httpOptions.port,
        protocol = httpOptions.protocol;
    var path = options.path,
        verb = options.verb,
        headers = options.headers,
        body = options.body;

    var client = protocol === 'https' ? https : http;

    var requestOptions = {
      hostname: host,
      port: port,
      method: verb,
      path: path,
      headers: headers
    };

    var req = https.request(requestOptions, function (res) {
      res.body = '';
      res.on('data', function (d) {
        res.body = res.body + d;
      });

      res.on('end', function (e) {
        resolve(res);
      });
    });

    req.on('error', function (e) {
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
    var errProxy = new Error('Response sent error level status code');
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
   * @param {object} config - Config object to configure your azuqua instace
   * @param {string} config.accessKey - The access key associated with the Azuqua account
   * @param {string} config.accessSecret - The access secret associated with the Azuqua account
   * @param {object} [config.httpOptions] - An httpOptions object to override default httpOptions
   */
  function Azuqua(config) {
    _classCallCheck(this, Azuqua);

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

  _createClass(Azuqua, [{
    key: 'createGroup',


    // Group Functions
    value: function createGroup(data) {
      return this.makeRequest('post', '/v2/group', data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'readGroup',
    value: function readGroup(id) {
      return this.makeRequest('get', '/v2/group/' + id, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'updateGroup',
    value: function updateGroup(id, data) {
      return this.makeRequest('put', '/v2/group/' + id, data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'deleteGroup',
    value: function deleteGroup(id) {
      return this.makeRequest('delete', '/v2/group/' + id, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'attachFloToGroup',
    value: function attachFloToGroup(groupId, floId) {
      return this.makeRequest('post', '/v2/group/' + groupId + '/attach/flo/' + floId, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'attachUserToGroup',
    value: function attachUserToGroup(groupId, userId) {
      return this.makeRequest('post', '/v2/group/' + groupId + '/attach/user/' + userId, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }

    // Org Functions

  }, {
    key: 'readOrg',
    value: function readOrg(id) {
      return this.makeRequest('get', '/v2/org/' + id, {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'updateOrg',
    value: function updateOrg(id, data) {
      return this.makeRequest('put', '/v2/org/' + id, data, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'readOrgFlos',
    value: function readOrgFlos(id, data) {
      return this.makeRequest('get', '/v2/org/' + id + '/flos', {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'readOrgConnectors',
    value: function readOrgConnectors(id, data) {
      return this.makeRequest('get', '/v2/org/' + id + '/connectors', {}, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }
  }, {
    key: 'inviteUserToOrg',
    value: function inviteUserToOrg(id, email) {
      var message = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'You have been invited to an Azuqua Org!';

      return this.makeRequest('post', '/v2/org/' + id + '/invite', { email: email, message: message }, { asJSON: true, errorOnStatusCode: true, onlyBody: true });
    }

    // Helper function for requesting arbitrary Azuqua endpoints

  }, {
    key: 'makeRequest',
    value: function makeRequest(verb, path, data) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      if (!this.account.accessKey || !this.account.accessSecret) {
        return Promise.reject(new Error('Account information not provided'));
      }
      var asJSON = options.asJSON,
          errorOnStatusCode = options.errorOnStatusCode,
          onlyBody = options.onlyBody;


      verb = verb.toLowerCase();
      var headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      var body = '';

      if (verb === 'get' || verb === 'delete') {
        var queryString = '';
        if (!_.isEmpty(data)) {
          var _queryString = querystring.stringify(data);
          path = path + '?' + _queryString;
        }
      } else {
        body = _.isEmpty(data) ? '' : JSON.stringify(data);
      }

      var authHeaders = Azuqua.generateHeaders(verb, path, this.account.accessKey, this.account.accessSecret, body);
      if (_.isError(authHeaders)) {
        throw authHeaders;
      }
      _.extend(headers, authHeaders);

      var requestOptions = {
        verb: verb,
        path: path,
        headers: headers,
        body: body
      };

      return request(this.httpOptions, requestOptions).then(function (res) {
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
      }).catch(function (e) {
        if (onlyBody) {
          var _body = requestOnlyBody(e.res);
          var errProxy = new Error('Response sent error level status code');
          errProxy.body = _body;
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

  }], [{
    key: 'newFromEnv',
    value: function newFromEnv(config) {
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
  }, {
    key: 'generateHeaders',
    value: function generateHeaders(verb, path, accessKey, accessSecret, data) {
      var timestamp = new Date().toISOString();

      var meta = [verb, path, timestamp].join(':') + data;
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

module.exports = Azuqua;