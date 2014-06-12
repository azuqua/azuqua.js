
var assert = require("chai").assert,
	Azuqua = require("../azuqua");

// not real
var testCredentials = {
    accessKey: "ca40b699bfd9cb76d78e1c9bb4a191465093a461",
    accessSecret: "eb1d531937fa94647f408636cb8f09f05344d0f0c3ac56e07ece508cedcecda3"
};

// if you're looking at this file for examples on how to instantiate the azuqua client
// please do not do it this way. it's better to store your credentials in a .json file
// and to load them with azuqua.loadConfig() or azuqua.loadConfigAsync()

describe("Azuqua client instantiation tests", function(){
	this.timeout(40000);

	describe("Client instantiation without credentials", function(){
		var azuqua = new Azuqua();

		it("Client should not start with any account information", function(){
			assert.typeOf(azuqua.account.accessKey, "undefined");
			assert.typeOf(azuqua.account.accessSecret, "undefined");
		});

	});

	describe("Client instantiation with credentials", function(){
		var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);

		it("Client should have an account property of type object", function(){
			assert.typeOf(azuqua.account, "object");
		});

		it("Client should have a non-null accessKey of type string", function(){
			assert.typeOf(azuqua.account.accessKey, "string");
			assert.lengthOf(azuqua.account.accessKey, 40);
		});

		it("Client should have a non-null accessSecret of type string", function(){
			assert.typeOf(azuqua.account.accessSecret, "string");
			assert.lengthOf(azuqua.account.accessSecret, 64);
		});

	});

	describe("Client instantiation with environment variables", function(){
		process.env.ACCESS_KEY = testCredentials.accessKey;
		process.env.ACCESS_SECRET = testCredentials.accessSecret;
		var azuqua = new Azuqua();

		it("Client should have an account property of type object", function(){
			assert.typeOf(azuqua.account, "object");
		});

		it("Client should have a non-null accessKey of type string", function(){
			assert.typeOf(azuqua.account.accessKey, "string");
			assert.lengthOf(azuqua.account.accessKey, 40);
		});

		it("Client should have a non-null accessSecret of type string", function(){
			assert.typeOf(azuqua.account.accessSecret, "string");
			assert.lengthOf(azuqua.account.accessSecret, 64);
		});

		process.env.ACCESS_KEY = false;
		process.env.ACCESS_SECRET = false;

	});


});

describe("Client configuration tests", function(){
	this.timeout(60000);

	describe("Client configuration with loadConfig", function(){

		var azuqua = new Azuqua();
		azuqua.loadConfig("./test/account.json");

		it("Client should have a non-null accessKey of type string", function(){
			assert.typeOf(azuqua.account.accessKey, "string");
			assert.lengthOf(azuqua.account.accessKey, 40);
		});

		it("Client should have a non-null accessSecret of type string", function(){
			assert.typeOf(azuqua.account.accessSecret, "string");
			assert.lengthOf(azuqua.account.accessSecret, 64);
		});

	});

	describe("Client configuration with loadConfigAsync", function(){
		var azuqua = new Azuqua();

		it("Client should asynchronously load configuration data", function(done){

			azuqua.loadConfigAsync("./test/account.json", function(error, resp){
				assert.typeOf(azuqua.account.accessKey, "string");
				assert.lengthOf(azuqua.account.accessKey, 40);
				assert.typeOf(azuqua.account.accessSecret, "string");
				assert.lengthOf(azuqua.account.accessSecret, 64);
				done();
			});

		});

	});

});

describe("Client API function tests", function(){
	this.timeout(60000);

	describe("Client API functions with callbacks", function(){

		describe("Client flo metadata tests", function(){

			describe("Client floMap cache test", function(){
				
				var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);

				it("Client should not start with any cached flos", function(){
					assert.typeOf(azuqua.floMap, "undefined");
				});

			});

			describe("Client floMap refresh tests", function(){
				var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);

				it("Client should list published flos as an array of strings", function(done){
					azuqua.flos(function(error, flos){
						assert.isNull(error);
						assert.instanceOf(flos, Array);
						done();
					});
				});

			});

		});

		describe("Client flo invocation tests", function(){

			var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);
			
			before(function(done){
				azuqua.flos(function(error, flos){
					done();
				});
			});

			it("Test flo should return the same starting data", function(done){
				azuqua.invoke("HTTP to HTTP", { something: 1 }, function(error, data){
					assert.isNull(error);
					assert.typeOf(data, "object");
					done();
				});
			});

			it("Test flo should fail if the accessSecret is invalid", function(done){
				azuqua.account.accessSecret = "1";
				azuqua.invoke("HTTP to HTTP", { something: 1 }, function(error, data){
					assert.typeOf(data, "undefined");
					assert.isNotNull(error);
					done();
				});
			});
			
		});


	});

	describe("Client API functions with promises", function(){

		describe("Client flo metadata tests", function(){

			describe("Client floMap cache test", function(){
				
				var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);

				it("Client should not start with any cached flos", function(){
					assert.typeOf(azuqua.floMap, "undefined");
				});

			});

			describe("Client floMap refresh tests", function(){
				var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);

				it("Client should list published flos as strings", function(done){
					azuqua.flos().then(function(flos){
						assert.instanceOf(flos, Array);
						done();
					});
				});

			});

		});

		describe("Client flo invocation tests", function(){

			var azuqua = new Azuqua(testCredentials.accessKey, testCredentials.accessSecret);
			
			before(function(done){
				azuqua.flos(function(error, flos){
					done();
				});
			});

			it("Test flo should return the same starting data", function(done){
				azuqua.invoke("HTTP to HTTP", { a: 1 }).then(function(data){
					assert.typeOf(data, "object");
					done();
				}, function(error){
					// no-op
					assert.isNull(error);
					done();
				});
			});

			it("Test flo should fail if the accessSecret is invalid", function(done){
				azuqua.account.accessSecret = "1";
				azuqua.invoke("HTTP to HTTP", { a: 1 }).then(function(data){
					// no-op
					assert.isNull(data);
					done();
				}, function(error){
					assert.isNotNull(error);
					done();
				});
			});
			
		});

	});

});

