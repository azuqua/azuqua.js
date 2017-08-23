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
var routes = require('../static/routes');
var FormData = require('form-data');
var stream = require('stream');

// External modules
var Promise = require('bluebird');
var _ = require('lodash');

var defaultRequestOptions = {
  asJSON: true,
  errorOnStatusCode: true,
  onlyBody: true
};

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

    var req = client.request(requestOptions, function (res) {
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
    var errProxy = new Error('Response sent error level status code');
    errProxy.res = res;throw errProxy;
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
  return new Promise(function (resolve, reject) {
    var hash = crypto.createHash('sha256');
    // Create a initial stream since FormData doesn't appear to like being forked
    var hashReadStream = formPassThrough.pipe(new stream.PassThrough());
    var unreadReadStream = formPassThrough.pipe(new stream.PassThrough());

    hashReadStream.on('data', function (data) {
      hash.update(data);
    });
    hashReadStream.on('end', function () {
      return resolve([hash.digest('hex'), unreadReadStream]);
    });
    hashReadStream.on('error', function (error) {
      return reject(error);
    });
  });
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
      port: 443,
      protocol: 'https'
    }, _.get(config, 'httpOptions', {}));

    // Finally set protocol
    this.protocol = this.httpOptions.port === 443 ? 'https' : 'http';

    Object.freeze(this.httpOptions);

    // Build routes
    this.buildRoutes();
  }

  _createClass(Azuqua, [{
    key: 'buildRoutes',
    value: function buildRoutes() {
      var _this = this;

      var azuqua = this;
      _.forOwn(routes, function (group) {
        _.forOwn(group, function (route, routeName) {
          var method = _.toUpper(_.head(_.get(route, 'methods')));
          var path = _.get(route, 'path');
          var params = path.split('/').filter(function (part) {
            return String(part).startsWith(':');
          });
          routeName = _.camelCase(routeName);
          _this[routeName] = function () {
            var _arguments = arguments;

            if (arguments.length < params.length) {
              throw new Error('Expected at least ' + params.length + ' arguments');
            }
            var newPath = path;
            params.forEach(function (param, idx) {
              newPath = newPath.replace(param, _arguments[idx]);
            });
            var data = {};
            if (method === 'POST' || method === 'PUT' && arguments.length > params.length) {
              if (_.isPlainObject(arguments[arguments.length - 1])) {
                data = arguments[arguments.length - 1];
              }
            }
            return azuqua.makeRequest(method, newPath, data, defaultRequestOptions);
          };
        });
      });
    }
  }, {
    key: 'invoke',
    value: function invoke(alias, data) {
      var _this2 = this;

      var _data$query = data.query,
          query = _data$query === undefined ? {} : _data$query,
          _data$headers = data.headers,
          headers = _data$headers === undefined ? {} : _data$headers,
          _data$body = data.body,
          body = _data$body === undefined ? {} : _data$body,
          _data$files = data.files,
          files = _data$files === undefined ? {} : _data$files;

      var verb = String(data.verb || 'post').toLowerCase();
      var timestamp = new Date().toISOString();

      // Create path
      var path = '/v2/flo/' + alias + '/invoke';
      var queryString = '';
      if (!_.isEmpty(query)) {
        var _queryString = querystring.stringify(query);
        path = path + '?' + _queryString;
      }

      var requestHeaders = _.extend({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-accesskey': this.account.accessKey,
        'x-api-timestamp': timestamp
      }, headers);

      var bodyHashInput = void 0;
      var bodyData = void 0;
      return Promise.resolve().then(function () {
        var filesPresent = _.isPlainObject(files) && !_.isEmpty(files);
        if (filesPresent || headers['Content-Type'] === 'multipart/form-data') {
          var form = new FormData();

          // Add body then files to request body
          Object.keys(body).forEach(function (bodyFieldName) {
            form.append(bodyFieldName, body[bodyFieldName]);
          });
          Object.keys(files).forEach(function (fileFieldName) {
            form.append(fileFieldName, files[fileFieldName]);
          });

          // Add headers to request
          _.extend(requestHeaders, form.getHeaders());

          var formPassThrough = new stream.PassThrough();
          form.pipe(formPassThrough);

          return formDataToHashAndStream(formPassThrough).spread(function (hash, stream) {
            bodyHashInput = hash;
            bodyData = stream;
            return '';
          });
        } else {
          bodyHashInput = bodyData = _.isEmpty(body) ? '' : JSON.stringify(body);
          return '';
        }
      }).then(function () {
        var meta = [verb, path, timestamp].join(':') + bodyHashInput;
        var hash = crypto.createHmac('sha256', _this2.account.accessSecret).update(new Buffer(meta, 'utf-8')).digest('hex');

        requestHeaders['x-api-hash'] = hash;

        var requestOptions = {
          verb: verb,
          path: path,
          headers: requestHeaders,
          body: bodyData
        };
        return request(_this2.httpOptions, requestOptions);
      }).then(function (res) {
        res = requestOnlyBody(res);
        return res;
      }).catch(function (e) {
        var body = requestOnlyBody(e.res);
        var errProxy = new Error('Response sent error level status code');
        errProxy.body = body;
        throw errProxy;
        throw e;
      });
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
          var _queryString2 = querystring.stringify(data);
          path = path + '?' + _queryString2;
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