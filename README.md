Azuqua Node.js client
=====================

Version 3 of the client (this version) is intented to be used to interact solely with version 2 of the Azuqua API.

This library provides an easy interface for interacting with your Azuqua account and information.
The Azuqua API is directly exposed to developers should you wish to write your own library.

### Installation:
`npm install azuqua`

In order to make API requests you will need both your accessKey and accessSecret.
These can also be found on your account information page.

### Usage

All functions return a promise.
By default Azuqua uses bluebird as its promise library.

```javascript
const Azuqua = require('./dist/azuqua.js');

const httpOptions = {
  host: 'api.azuqua.com',
  port: 443
};

const azuqua = new Azuqua({
  accessKey: 'ACCESS_KEY',
  accessSecret: 'ACCESS_SECRET',
  httpOptions
});

const EXAMPLE_ORG_ID = 42;
const EXAMPLE_GROUP_ID = 10;

// Some examples for doing org management
azuqua.createGroup({ org_id: EXAMPLE_ORG_ID, name: 'New Group', description: 'This is a group' })
  .then(console.log)
  .catch(console.error);

azuqua.readGroup(EXAMPLE_GROUP_ID)
  .then(console.log)
  .catch(console.error);

azuqua.updateGroup(EXAMPLE_GROUP_ID, { name: 'New name' })
  .then(console.log)
  .catch(console.error);

azuqua.deleteGroup(EXAMPLE_GROUP_ID)
  .then(console.log)
  .catch(console.error);

```
LICENSE - "MIT License"
=======================
Copyright (c) 2017 Azuqua

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
