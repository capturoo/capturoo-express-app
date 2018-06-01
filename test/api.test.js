'use strict';
const crypto = require('crypto');
const request = require('supertest');
const chai = require('chai');
const assert = chai.assert;
const { DashboardSDK } = require('capturoo-dashboard-sdk');
const config = require('../config');
const clientConfig = require('../client-config');

const TIMEOUT_SETUP_MS = 40 * 1000;
const TIMEOUT_MS = 40 * 1000;
const TEST_ENDPOINT = process.env.TEST_ENDPOINT || 'app';
const TEST_EMAIL = process.env.TEST_EMAIL || 'user@example.com';
const TEST_SHOWTOKEN = (process.env.TEST_SHOWTOKEN === 'true') ? true : false;

const leads = [
  {
    firstname: 'David',
    lastname: 'Smith',
    age: 42
  },
  {
    firstname: 'Borris',
    lastname: 'Johnson',
    age: 56
  },
  {
    firstname: 'Julia',
    lastname: 'Carter',
    age: 28
  },
  {
    firstname: 'Paul',
    lastname: 'Rogers',
    age: 34
  },
  {
    firstname: 'Fred',
    lastname: 'Blogs',
    age: 27
  }
];

describe('API Integration tests', () => {
  var endpoint;
  var sdk;
  var token;
  var accountObj;
  var publicApiKey;
  var leadIds = [];
  var leadIdToDelete;
  var startAfter;

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
    this.timeout(TIMEOUT_SETUP_MS);

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

  it(`GetAccount: should retrieve the current user '${TEST_EMAIL}' account`, function(done) {
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

  it(`CreateProject: should fail to create a project due to missing name field`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .post('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .send({
        projectId: newProjectId
      })
      .expect('Content-Type', /application\/json/)
      .expect(400)
      .end(function(err, res) {
        if (err) {
          console.error(err);
          return done(err);
        }

        assert.isObject(res.body);
        assert.hasAllKeys(res.body, ['status', 'message', 'info']);
        assert.equal(res.body.status, 400);
        assert.strictEqual(res.body.message, 'api/bad-request');
        done();
      });
  });

  it(`CreateProject: should create a new project '${newProjectId}'`, function(done) {
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

  it(`ProjectExists: should check project '${newProjectId}' exists`, function(done) {
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

  it(`ProjectExists: should ensure project '${newProjectId}-not-there' does not exist`, function(done) {
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

  it(`CreateProject: should fail to create the same project '${newProjectId}'`, function(done) {
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

  it(`GetProject: should get project '${newProjectId}' by its id`, function(done) {
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
        assert.lengthOf(res.body.publicApiKey, 22);

        // keep a copy of this project's public API key for lead capture below
        publicApiKey = res.body.publicApiKey;
        done();
      });
  });

  it(`GetProject: should fail to get project '${newProjectId}' as missing x-access-token`, function(done) {
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

  it('GetProject: should fail to retrieve a project that does not exist', function(done) {
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

  it('ListProjects: should retrieve a list of all projects', function(done) {
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

  it('CreateLead: should create a set of leads', async function() {
    this.timeout(TIMEOUT_MS);

    async function sendLead(data) {
      return request(endpoint)
        .post('/leads')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', publicApiKey)
        .send({
          system: {},
          lead: data,
          tracking: {}
        })
        .expect('Content-Type', /application\/json/)
        .expect(201);
    }

    try {
      var promises = [];
      for (const l of leads) {
        let p = sendLead(l);
        promises.push(p);
        let res  = await p;
        assert.isObject(res.body);
        assert.hasAllKeys(res.body.lead, ['firstname', 'lastname', 'age']);
        assert.strictEqual(res.body.lead.firstname, l.firstname);
        assert.strictEqual(res.body.lead.lastname, l.lastname);
        assert.strictEqual(res.body.lead.age, l.age);
      };
    } catch (err) {
      throw err;
    }
    return Promise.all(promises);
  });

  it('CreateLead: should create a single lead', function(done) {
    this.timeout(TIMEOUT_MS);
    let data = {
      firstname: 'Soontobe',
      lastname: 'Deleted',
      age: 99
    };

    request(endpoint)
    .post('/leads')
    .set('Content-Type', 'application/json')
    .set('X-API-Key', publicApiKey)
    .send({
      system: {},
      lead: data,
      tracking: {}
    })
    .expect('Content-Type', /application\/json/)
    .expect(201)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isObject(res.body);
      leadIdToDelete = res.body.system.leadId;
      done();
    });
  });

  it(`DeleteLead: should delete an individual lead (${leadIdToDelete})`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newProjectId}/leads/${leadIdToDelete}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(204)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isObject(res.body);
      leadIdToDelete = res.body.leadId;
      done();
    });
  });

  it(`DeleteLead: should fail to delete an individual lead '${leadIdToDelete}' from project '${newProjectId}-nt'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newProjectId}-nt/leads/${leadIdToDelete}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
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

  it(`DeleteLead: should fail to delete an individual lead '${leadIdToDelete}-nt' from project '${newProjectId}'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newProjectId}/leads/${leadIdToDelete}-nt`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
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
      assert.strictEqual(res.body.message, 'leads/lead-not-found');
      done();
    });
  });

  it('QueryLeads: should query leads order by default (created desc)', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 5);

      // 1st lead should be the last one created
      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'Fred',
        lastname: 'Blogs',
        age: 27
      });

      // 5th lead should be the first one created
      assert.isObject(res.body[4]);
      assert.deepEqual(res.body[4].lead, {
        firstname: 'David',
        lastname: 'Smith',
        age: 42
      });
      done();
    });
  });

  it('QueryLeads: should query all leads order by created asc', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderDirection=asc`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 5);

      // 1st lead should be the first one created
      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'David',
        lastname: 'Smith',
        age: 42
      });
      assert.hasAnyKeys(res.body[0].system, ['created', 'ip', 'leadNum', 'leadId']);

      // 5th lead should be the last one created
      assert.isObject(res.body[4]);
      assert.deepEqual(res.body[4].lead, {
        firstname: 'Fred',
        lastname: 'Blogs',
        age: 27
      });
      assert.hasAnyKeys(res.body[4].system, ['created', 'ip', 'leadNum', 'leadId']);


      // keep a copy of the lead ids
      for (const item of res.body) {
        leadIds.push(item.system.leadId);
      }
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created ascending limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=asc&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 2);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'David',
        lastname: 'Smith',
        age: 42
      });

      assert.isObject(res.body[1]);
      assert.deepEqual(res.body[1].lead, {
        firstname: 'Borris',
        lastname: 'Johnson',
        age: 56
      });

      startAfter = res.body[1].system.created;
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created ascending startAfter last limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=asc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 2);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'Julia',
        lastname: 'Carter',
        age: 28
      });

      assert.isObject(res.body[1]);
      assert.deepEqual(res.body[1].lead, {
        firstname: 'Paul',
        lastname: 'Rogers',
        age: 34
      });

      startAfter = res.body[1].system.created;
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created ascending startAfter last limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=asc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 1);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'Fred',
        lastname: 'Blogs',
        age: 27
      });

      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created descending limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=desc&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 2);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'Fred',
        lastname: 'Blogs',
        age: 27
      });

      assert.isObject(res.body[1]);
      assert.deepEqual(res.body[1].lead, {
        firstname: 'Paul',
        lastname: 'Rogers',
        age: 34
      });

      startAfter = res.body[1].system.created;
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created descending startAfter last limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=desc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 2);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'Julia',
        lastname: 'Carter',
        age: 28
      });

      assert.isObject(res.body[1]);
      assert.deepEqual(res.body[1].lead, {
        firstname: 'Borris',
        lastname: 'Johnson',
        age: 56
      });

      startAfter = res.body[1].system.created;
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created descending startAfter last limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads?orderBy=system_created&orderDirection=desc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.lengthOf(res.body, 1);

      assert.isObject(res.body[0]);
      assert.deepEqual(res.body[0].lead, {
        firstname: 'David',
        lastname: 'Smith',
        age: 42
      });

      done();
    });
  });

  it('GetLead: Get a single lead by ID', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads/${leadIds[1]}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isObject(res.body);
      assert.deepEqual(res.body.lead, {
        firstname: 'Borris',
        lastname: 'Johnson',
        age: 56
      });
      assert.strictEqual(res.body.system.leadId, leadIds[1]);
      done();
    });
  });

  it(`GetLead: should fail to get a lead by incorrect lead ID`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newProjectId}/leads/notthere`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
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
      assert.strictEqual(res.body.message, 'leads/lead-not-found');
      done();
    });
  });

  it(`DeleteProject: should delete project '${newProjectId}'`, function(done) {
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

  it(`DeleteProject: should fail to delete project '${newProjectId}' as it just got deleted`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .delete(`/projects/${newProjectId}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
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

  it(`GetProject: should fail to get the previously deleted project '${newProjectId}'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newProjectId}`)
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
