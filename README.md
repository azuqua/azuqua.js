Azuqua Node.js client
=====================

Version 3 of the client (this version) is intented to be used to interact solely with version 2 (Routes prefixed with /v2/) of the Azuqua API.

This library provides an easy interface for interacting with your Azuqua account and information.
The Azuqua API is directly exposed to developers should you wish to write your own library.

### Installation:
`npm install azuqua`

In order to make API requests you will need both your accessKey and accessSecret or an org.
These can also be found on your account information page. Settings > Developer Settings.

### Usage

All functions return a promise.
Azuqua.js uses bluebird as its promise library.

```javascript
const Azuqua = require('./dist/azuqua.js');

const httpOptions = {
  host: 'api.azuqua.com',
  protocol: 'https',
  port: 443
};

const azuqua = new Azuqua({
  accessKey: 'ACCESS_KEY',
  accessSecret: 'ACCESS_SECRET',
  httpOptions
});



azuqua.readAllAccounts()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readAccount(accountId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.deleteAccount(accountId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "role": "NONE"
}
azuqua.updateAccountUserPermissions(accountId, userId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readConnectorVersion(connectorName, connectorVersion)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFlo(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "name": "",
  "description": ""
}
azuqua.updateFlo(floId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.deleteFlo(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.enableFlo(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.disableFlo(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFloInputs(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFloAccounts(floId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.moveFloToFolder(floId, folderId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "configs": "",
  "inputs": [],
  "outputs": []
}
azuqua.modifyFlo(floId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "folder_id": 0
}
azuqua.copyFlo(floId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "folder_id": 0
}
azuqua.copyFloToOrg(floId, orgId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readAllFolders()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "name": "",
  "description": ""
}
azuqua.createFolder(data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFolder(folderId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "name": "",
  "description": ""
}
azuqua.updateFolder(folderId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.deleteFolder(folderId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFolderFlos(folderId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readFolderUsers(folderId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "role": "NONE"
}
azuqua.updateFolderUserPermissions(folderId, userId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readOrg()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "name": "",
  "display_name": ""
}
azuqua.updateOrg(data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readOrgFlos()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readOrgConnectors()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.removeUserFromOrg(userId)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned


const data = {
  "role": "MEMBER"
}
azuqua.updateOrgUserPermissions(userId, data)
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned



azuqua.readUserOrgs()
  .then(console.log) // Log the data returned
  .catch(console.error) // Log the error returned

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
