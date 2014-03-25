<h1>Azuqua Node.js client</h1>
<p>
	This library provides an easy interface for interacting with your Azuqua flos.
	The Azuqua API is directly exposed to developers should you wish to write your own library.
	For full API documentation please visit <a href="//developer.azuqua.com">developer.azuqua.com</a>.
</p>
<p>
	Installation:
	<pre> npm install azuqua </pre>
</p>
<p>
	In order to make API requests you will need both your accessKey and accessSecret.
	These can also be found on your account information page. 
</p>
<h1>Usage</h1>
<strong>
	All asynchronous functions can return a promise if you prefer that pattern.
	When you call an asynchronous function and 
	leave the callback undefined it will return a promise.
	By default Azuqua uses bluebird.
</strong>
<pre>
	
	var async  = require("async"),
		Azuqua = require("azuqua");
	// you can provide your accessKey and accessSecret here, but it's not recommended to hard-code these values
	var azuqua = new Azuqua(); 

	// the recommended pattern is to store them in a .json file
	azuqua.loadConfig("./account.json"); 

	// invoke all your flos
	var data = { a: 1 };
	azuqua.flos(function(error, flos){
		async.each(flos, function(flo, callback){
			azuqua.invoke(flo, data, function(err, resp){
				if(err){
					console.log("Error invoking flo!", flo, err);
					callback(err);
				}else{
					console.log("Flo returned: ", resp);
					callback();
				}
			});
		}, function(err){
			if(err)
				console.log("Flo invocation loop stopped!", err);
			else
				console.log("Finished invoking flos!");
		});
	});

</pre>
<hr>
<h1>LICENSE - "MIT License"</h1>
<hr>
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
