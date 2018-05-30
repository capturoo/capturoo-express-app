'use strict';
const crypto = require('crypto');
const request = require('supertest');
const chai = require('chai');
const assert = chai.assert;
const { DashboardSDK } = require('capturoo-dashboard-sdk');
const config = require('../config');
const clientConfig = require('../client-config');

const TIMEOUT_MS = 10 * 1000;
const TEST_ENDPOINT = process.env.TEST_ENDPOINT || 'app';
const TEST_EMAIL = process.env.TEST_EMAIL || 'user@example.com';
const TEST_SHOWTOKEN = (process.env.TEST_SHOWTOKEN === 'true') ? true : false;

describe('API Integration tests', () => {
  var endpoint;
  var sdk;
  var token;
  var accountObj;

	var newProjectId = (function () {
    let base62 = '0123456789';
    let str = '';
    for (let b of crypto.randomBytes(6)) {
      str += base62[b % 10];
    };
    return `test-${str}`;
  })();

  // Create the Express app, a DashboardSDK client and signIn retreiving a JWT
  // that is used for all subsequent requests
  before(function(done) {
    this.timeout(TIMEOUT_MS);
   
    if (TEST_ENDPOINT === 'app') { 
      const ExpressApp = require('../lib/app');
      endpoint = new ExpressApp(config);
    } else {
      endpoint = TEST_ENDPOINT;
    }

    sdk = new DashboardSDK(clientConfig);
		sdk.signInWithEmailAndPassword(TEST_EMAIL, process.env.TEST_PASSWORD)
      .then(userCredential => {
        token = sdk.idTokenResult.token;
        if (TEST_SHOWTOKEN) {
          console.log(token);
        }
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it(`should retrieve the current user (${TEST_EMAIL}) account`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get('/account')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .expect('Content-Type', /application\/json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

				assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'accountId',
          'email',
          'created',
          'lastModified'
        ]);
        assert.lengthOf(res.body.accountId, 28);
        assert.lengthOf(res.body.created, 24);
        assert.lengthOf(res.body.lastModified, 24);
        accountObj = res.body;
        done();
      });
  });

  it(`should create a new project (${newProjectId})`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .post('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .send({
        projectId: newProjectId,
        name: 'Supertest Project'
      })
      .expect('Content-Type', /application\/json/)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          console.error('err...');
          console.error(res.text);
          return done(err);
        }
        assert.hasAllKeys(res.body, [
          'projectId',
          'accountId',
          'name',
          'publicApiKey',
          'created',
          'lastModified'
        ]);
        assert.strictEqual(res.body.projectId, newProjectId);
        assert.strictEqual(res.body.name, 'Supertest Project');
        done();
      });
  });

  it(`should check project (${newProjectId}) exists`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .head(`/projects/${newProjectId}`)
      .set('x-access-token', token)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }
        assert.isObject(res.body);
        assert.isEmpty(res.body);
        done();
      });
  });

  it(`should ensure project (${newProjectId}-not-there) does not exist`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .head(`/projects/${newProjectId}-not-there`)
      .set('x-access-token', token)
      .expect(404)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.isEmpty(res.body);
        done();
      }); 
  });

  it(`should fail to create the same project (${newProjectId})`, function(done) {
  	this.timeout(TIMEOUT_MS);
    request(endpoint)  
      .post('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .send({
        projectId: newProjectId,
        name: 'Supertest Project'
      })
      .expect('Content-Type', /application\/json/)
      .expect(409)
      .end(function(err, res) {
        if (err) {
          console.error('err...');
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.hasAllKeys(res.body, ['status', 'message']);
        assert.equal(res.body.status, 409);
        assert.strictEqual(res.body.message, 'projects/project-id-taken');
        done();
      });

  });

  it(`should retrieve a project (${newProjectId}) using its id`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newProjectId}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .expect('Content-Type', /application\/json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'projectId',
          'accountId',
          'name',
          'leadsCount',
          'publicApiKey',
          'created',
          'lastModified'
        ]);
        assert.strictEqual(res.body.projectId, newProjectId);
        assert.strictEqual(res.body.accountId, accountObj.accountId);
        assert.strictEqual(res.body.name, 'Supertest Project');
        assert.strictEqual(res.body.leadsCount, 0);
        done();
      });
  });

  it(`should fail retrieve a project (${newProjectId}) because of missing x-access-token`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newProjectId}`)
      .set('Content-Type', 'application/json')
      .expect('Content-Type', /application\/json/)
      .expect(403)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }
        assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'status',
          'message'
        ]);
        assert.strictEqual(res.body.status, 403);
        assert.strictEqual(res.body.message, 'auth/missing-api-key-or-token');
        done();
      });
  });

  it('should fail to retrieve a project that does not exist', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/no-such-project-${newProjectId}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .expect('Content-Type', /application\/json/)
      .expect(404)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'status',
          'message'
        ]);
        assert.strictEqual(res.body.status, 404);
        assert.strictEqual(res.body.message, 'projects/project-not-found');
        done();
      });
  });

  it('should retrieve a list of all projects', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .expect('Content-Type', /application\/json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }
        assert.isArray(res.body);
        done();
      });
  });

  it(`should delete project ${newProjectId}`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .delete(`/projects/${newProjectId}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .expect(204)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.isEmpty(res.body);
        done();
      });
  });

  after(function(done) {
    sdk.signOut()
      .then(() => {
        done();
      })
      .catch(err => {
        done(err);
      });
  });
});
