THIS IS A V2 JS CLIENT - WORK IN PROGRESS

Azuqua Node.js client
=====================

This library provides an easy interface for interacting with your Azuqua flos.
The Azuqua API is directly exposed to developers should you wish to write your own library.
For full API documentation please visit [developer.azuqua.com]("https//developer.azuqua.com")

### Installation:
`npm install azuqua`

In order to make API requests you will need both your accessKey and accessSecret.
These can also be found on your account information page.

### Usage

All asynchronous functions can return a promise if you prefer that pattern.
When you call an asynchronous function and
leave the callback undefined it will return a promise.
By default Azuqua uses bluebird as its promise library.

```javascript
var async  = require("async");
var config = require("./config.json");
var Azuqua = require("azuqua");

// Overriding httpOptions is option
var httpOptions = {
  host: "api.azuqua.com", // URL of the api for your instance
  port: 443,
  protocol: "https"
};

// Create a new instance of an Azuqua client
var azuqua = new Azuqua(
  // accessKey and accessSecret are obtainable from the account options in the Azuqua designer
  config.accessKey,
  config.accessSecret,
  httpOptions // this is optinal - only required if you are not interacting with the production Azuqua.com instance
);

// Read all flos and then invoke them
var data = { a: 1 };
azuqua.flos(function (error, flos) {
	async.each(flos, function (flo, callback) {
		azuqua.invoke(flo, data, function (err, resp) {
			if (err) {
				console.log("Error invoking flo!", flo, err);
				callback(err);
			} else {
				console.log("Flo returned: ", resp);
				callback();
			}
		});
	}, function (err) {
		if(err)
			console.log("Flo invocation loop stopped!", err);
		else
			console.log("Finished invoking flos!");
	});
});

// Of course, promises are supported too...
var data = { a : 1 };
azuqua.flos()
  .then(function (flos) {
    var firstFlo = flos.pop();
    return azuqua.invoke(firstFlo, { data : { name : Azuqua } })
  }).then(function (response) {
    console.log('Got a response from invoking a flo!', response);
  }).catch(function (error) {
    console.log('Uh oh! We got an error');
  })

// Version 2 also supports custom requests via the static makeRequests method
azuqua.makeRequest('GET', '/flo/:alias/read', { alias : 'aliashere' })
  .then(function (response) {
    console.log('Here!');
    console.log(response.name);
  }).catch(function (error) {
    console.log('Error: ', error);
  });

```
LICENSE - "MIT License"
=======================
Copyright (c) 2014 Azuqua

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
