// Export of all the methods that src/azuqua.js will hit
// Each route has related path and method. These methods are the
// 'recommended' method for the route but not necesarrily the only
// method the route excepts.
// For example, API will access GET and POST for reading a flo
module.exports = {
  readFlo: {
    path: '/flo/:alias/read',
    method: 'GET'
  },
  invoke: {
    path: '/flo/:alias/invoke',
    method: 'POST'
  },
  resume: {
    path: '/flo/:alias/resume/:exec',
    method: 'POST'
  },
  inject: {
    path: '/flo/:alias/inject',
    method: 'POST'
  },
  enable: {
    path: '/flo/:alias/enable',
    method: 'POST'
  },
  disable: {
    path: '/flo/:alias/disable',
    method: 'POST'
  },
  flos: {
    path: '/account/flos',
    method: 'GET'
  },
  schedule: {
    path: '/flo/:alias/schedule',
    method: 'POST'
  },
  retry: {
    path: '/flo/:alias/retry',
    method: 'POST'
  },
  inputs: {
    path: '/flo/:alias/inputs',
    method: 'GET'
  },
  outputs: {
    path: '/flo/:alias/outputs',
    method: 'GET'
  },
  groups: {
    path: '/user/orgs',
    method: 'GET'
  },
  createRule: {
    path: '/rule',
    method: 'POST'
  },
  readRule: {
    path: '/rule/:id',
    method: 'GET'
  },
  updateRule: {
    path: '/rule/:id',
    method: 'PUT'
  },
  deleteRule: {
    path: '/rule/:id',
    method: 'DELETE'
  },
  readAllRules: {
    path: '/rules',
    method: 'GET'
  },
  linkRuleAndFlo: {
    path: '/rule/:ruleId/associate/:floId',
    method: 'POST'
  }
};
