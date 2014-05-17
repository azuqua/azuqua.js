
var async = require("async"),
  _ = require("underscore"),
  fs = require("fs"),
  crypto = require("crypto"),
  RestJS = require("restjs"),
  Promise = require("bluebird");

  if(RestJS.Rest)
    RestJS = RestJS.Rest;

// Azuqua Node.js Client Library
// -----------------------------

// This library provides an easy interface for interacting with your Azuqua flos.
// The Azuqua API is directly exposed to developers should you wish to write your own library.
// For full API documentation please visit <a href="//developer.azuqua.com">developer.azuqua.com</a>.

// In order to make API requests you will need both your accessKey and accessSecret.
// These can be found on your account information page. 

// <strong>
// All asynchronous functions can return a promise if you prefer that pattern.
// By default when you call an asynchronous function and 
// leave the callback undefined it will return a promise.
// By default Azuqua uses <a href="https://github.com/petkaantonov/bluebird">bluebird</a>.
// </strong>

// Should you wish to write your own library that makes HTTP requests directly you will need to provide the following data:

// `data: "stringified json object",` <br/>
// `hash: "the hexidecimal string output of a HMAC of the data object signed by your accessSecret",` <br/>
// `accessKey: "your access key"`

// Please note that the API rate limits all clients by the maximum number of requests per second
// as determined by your account plan. By default this is 3 requests per second.

// Flos are not directly invocable via their name on the API. To invoke a flo you first need to 
// get the alias for the flo. These can be found at the /api/account/flos route. This client maintains
// an internal mapping between each flo name and its alias so you can invoke flos directly by their name.

var routes = {
  invoke: { 
    path: "/api/flo/:id/invoke",
    method: "POST"
  },
  flos: {
    path: "/api/account/flos",
    method: "POST"
  }
};

var wrapAsyncFunction = function(fn, args){
  args = Array.prototype.slice.call(args);
  var callback = args[args.length - 1];
  if(typeof callback !== "function"){
    var deferred = Promise.defer();
    args.push(function(error, data){
      if(error)
        deferred.reject(error);
      else
        deferred.resolve(data);
    });
    fn.apply(fn, args);
    return deferred.promise;
  }else{
    fn.apply(fn, args);
  }
};

var signData = function(accessSecret, data){
  if(typeof data === "object")
    data = JSON.stringify(data);
  return crypto.createHmac("sha256", accessSecret).update(data).digest("hex");
};

var addGetParameter = function(path, key, value){
  var delimiter = path.indexOf("?") > -1 ? "&" : "?";
  return path + delimiter + key + "=" + value;
};

// Constructor
// -----------

// Create a new Azuqua client.

// This function first attempts to read accessKey and accessSecret data from environment variables.
// These can be set with ACCESS_KEY and ACCESS_SECRET. 
// It then attempts to read them from the function's arguments.
// You can overwrite the environment variables this way if necessary, 
// although it's not recommended to hard-code your account credentials.
var Azuqua = function(accessKey, accessSecret){
  var self = this;

  self.account = {};
  if(process.env.ACCESS_KEY)
    self.account.accessKey = process.env.ACCESS_KEY;
  if(process.env.ACCESS_SECRET)
    self.account.accessSecret = process.env.ACCESS_SECRET;
  if(typeof accessKey === "string")
    self.account.accessKey = accessKey;
  if(typeof accessSecret === "string")
    self.account.accessSecret = accessSecret;

  self.httpOptions = {
    host: "api.azuqua.com",
    port: 443,
    headers: {
      "Content-Type": "application/json"
    }
  };

  self.client = new RestJS({ protocol: "https" });

  self.makeRequest = function(options, params, callback){
    if(!self.account || !self.account.accessKey || !self.account.accessSecret)
      return callback(new Error("Account information not found"));
    var data = {};
    _.each(self.httpOptions, function(value, key){
      options[key] = value;
    });
    var hash = signData(self.account.accessSecret, params);
    if(options.method === "POST"){
      data.accessKey = self.account.accessKey;
      data.data = params;
      data.hash = hash;
    }else{
      options.path = addGetParameter(options.path, "accessKey", self.account.accessKey);
      options.path = addGetParameter(options.path, "data", 
        encodeURIComponent(typeof params === "object" ? JSON.stringify(params) : params));
      options.path = addGetParameter(options.path, "hash", hash);
    }
    data = JSON.stringify(data);
    options.headers["Content-Length"] = Buffer.byteLength(data);
    self.client.request(options, data, function(error, resp){
      if(error){
        callback(error);
      }else{
        try{
          resp.body = JSON.parse(resp.body);
        }catch(e){
          return callback(resp.body);
        }
        if(resp.body.error)
          callback(new Error(resp.body.error));
        else
          callback(null, resp.body);
      }
    });
  };

};

// Account Configuration
// ---------------------

// <strong>loadConfig</strong>

// Read accessKey and accessSecret data from a .json file.

// Note: This function blocks. Use loadConfigAsync for the async variant.
Azuqua.prototype.loadConfig = function(path){
  this.account = require(path);
};

// <strong>loadConfigAsync</strong>

// Asynchronously read accessKey and accessSecret data from a .json file.
Azuqua.prototype.loadConfigAsync = function(_path, _callback){
  var self = this;
  return wrapAsyncFunction(function(path, callback){
    fs.readFile(path, { encoding: "utf8" }, function(error, data){
      if(error){
        callback(error);
      }else{
        try{
          data = JSON.parse(data);
        }catch(e){
          return callback(e);
        }
        if(data.accessKey && data.accessSecret){
          self.account = data;
          callback(null, true);
        }else{
          callback(new Error("Invalid account credentials"));
        }
      }
    });
  }, arguments);
};

// API Functions
// -------------

// <strong>invoke</strong>

// Invoke a Flo identified by @flo with @data.
// @flo is a string representing the flo name.
// You can enumerate the output of flos() to see all flo names.
Azuqua.prototype.invoke = function(_flo, _data, _callback){
  var self = this;
  return wrapAsyncFunction(function(flo, data, callback){
    if(self.floMap[flo]){
      var options = routes.invoke;
      options.path = options.path.replace(":id", self.floMap[flo]);
      self.makeRequest(options, data, function(error, resp){
        if(error)
          callback(error);
        else
          callback(null, resp.data);
      });
    }else{
      callback(new Error("Flo not found. Try refreshing the flos cache"));
    }
  }, arguments);
};


// <strong>flos</strong>

// List all flos for your organization.

// Note: This caches the flos locally. To refresh them provide a truthy first parameter. 
Azuqua.prototype.flos = function(_refresh, _callback){
  var self = this;
  return wrapAsyncFunction(function(refresh, callback){
    if(typeof refresh === "function"){
      callback = refresh;
      refresh = false;
    }
    if(self.floMap && !refresh){
      callback(null, self.floMap);
    }else{
      self.makeRequest(routes.flos, {}, function(error, flos){
        if(error){
          callback(error);
        }else{
          self.floMap = {};
          var out = [];
          async.each(flos, function(flo, cb){
            if(!self.floMap[flo.name])
              out.push(flo.name);
            self.floMap[flo.name] = flo.alias;
            cb();
          }, function(){
            callback(null, out);
          });
        }
      });
    }
  }, arguments);
};


module.exports = Azuqua;
