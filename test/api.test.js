'use strict';
const crypto = require('crypto');
const request = require('supertest');
const chai = require('chai');
const assert = chai.assert;
const config = require('../config');
const capturoo = require('@capturoo/app');
require('@capturoo/auth');
const clientConfig = require('../client-config');

const TIMEOUT_SETUP_MS = 40 * 1000;
const TIMEOUT_MS = 40 * 1000;
const TEST_ENDPOINT = process.env.TEST_ENDPOINT || 'app';
const TEST_SHOWTOKEN = (process.env.TEST_SHOWTOKEN === 'true') ? true : false;
const APP_VERSION = process.env.TEST_APP_VERSION;

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


describe(`Integration tests (API version ${APP_VERSION})`, () => {
  var endpoint;
  var auth;
  var token;
  var accountObj;
  var publicApiKey;
  var leadIds = [];
  var leadIdToDelete;
  var startAfter;

	var newPid = (function () {
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

    capturoo.initApp(clientConfig);
    auth = capturoo.auth();
		auth.signInWithEmailAndPassword(process.env.TEST_EMAIL, process.env.TEST_PASSWORD)
      .then(userCredential => {
        token = auth.idTokenResult.token;
        if (TEST_SHOWTOKEN) {
          console.log(token);
        }
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it(`GetAccount: should retrieve the current user account`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get('/account')
      .set('Content-Type', 'application/json')
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .set('x-access-token', token)
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

				assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'aid',
          'email',
          'displayName',
          'privateApiKey',
          'created',
          'lastModified'
        ]);
        assert.lengthOf(res.body.aid, 28);
        assert.lengthOf(res.body.created, 24);
        assert.lengthOf(res.body.lastModified, 24);
        accountObj = res.body;
        done();
      });
  });

  // it(`CreateProject: should fail to create a project due to missing name field`, function(done) {
  //   this.timeout(TIMEOUT_MS);
  //   request(endpoint)
  //     .post('/projects')
  //     .set('Content-Type', 'application/json')
  //     .set('x-access-token', token)
  //     .set('x-capturoo-timing', 'on')
  //     .set('x-capturoo-version', 'on')
  //     .send({
  //       pid: newPid
  //     })
  //     .expect('Content-Type', /application\/json/)
  //     .expect('x-capturoo-app-version', APP_VERSION)
  //     .expect(400)
  //     .end(function(err, res) {
  //       if (err) {
  //         console.error(err);
  //         return done(err);
  //       }

  //       assert.isObject(res.body);
  //       assert.hasAllKeys(res.body, ['status', 'message', 'info']);
  //       assert.equal(res.body.status, 400);
  //       assert.strictEqual(res.body.message, 'api/bad-request');
  //       done();
  //     });
  // });

  it(`CreateProject: should create a new project '${newPid}'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .post('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .send({
        pid: newPid,
        projectName: 'Supertest Project'
      })
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }
        assert.hasAllKeys(res.body, [
          'pid',
          'projectName',
          'leadsCount',
          'publicApiKey',
          'created',
          'lastModified'
        ]);
        assert.strictEqual(res.body.pid, newPid);
        assert.strictEqual(res.body.projectName, 'Supertest Project');
        done();
      });
  });

  it(`CreateProject: should fail to create the same project '${newPid}'`, function(done) {
  	this.timeout(TIMEOUT_MS);
    request(endpoint)
      .post('/projects')
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .send({
        pid: newPid,
        projectName: 'Supertest Project'
      })
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
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

  it(`GetProject: should get project '${newPid}' by its id`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        assert.hasAllKeys(res.body, [
          'pid',
          'projectName',
          'leadsCount',
          'publicApiKey',
          'created',
          'lastModified'
        ]);
        assert.strictEqual(res.body.pid, newPid);
        assert.strictEqual(res.body.projectName, 'Supertest Project');
        assert.strictEqual(res.body.leadsCount, 0);
        assert.lengthOf(res.body.publicApiKey, 6);

        // keep a copy of this project's public API key for lead capture below
        publicApiKey = res.body.publicApiKey;
        done();
      });
  });

  it(`GetProject: should fail to get project '${newPid}' as missing x-access-token`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
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
      .get(`/projects/no-such-project-${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
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
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
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

    let xApiKey = `${publicApiKey}${accountObj.aid}`;
    async function sendLead(data) {
      return request(endpoint)
        .post('/leads')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', xApiKey)
        .set('x-capturoo-timing', 'on')
        .set('x-capturoo-version', 'on')
        .send({
          system: {},
          lead: data,
          tracking: {}
        })
        .expect('Content-Type', /application\/json/)
        .expect('x-capturoo-app-version', APP_VERSION)
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
    let lead = {
      firstname: 'Soontobe',
      lastname: 'Deleted',
      age: 99
    };

    let xApiKey = `${publicApiKey}${accountObj.aid}`;

    request(endpoint)
      .post('/leads')
      .set('Content-Type', 'application/json')
      .set('X-API-Key', xApiKey)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .send({
        system: {},
        lead,
        tracking: {}
      })
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          console.error(res.text);
          return done(err);
        }

        assert.isObject(res.body);
        leadIdToDelete = res.body.system.lid;
        done();
      });
  });

  it(`DeleteLead: should delete an individual lead`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newPid}/leads/${leadIdToDelete}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
    .expect(204)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isObject(res.body);
      done();
    });
  });

  it(`DeleteLead: should fail to delete an individual lead from project`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newPid}-nt/leads/${leadIdToDelete}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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

  it(`DeleteLead: should fail to delete an individual lead from project`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .delete(`/projects/${newPid}/leads/${leadIdToDelete}-nt`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderDirection=asc`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
      assert.hasAnyKeys(res.body[0].system, ['created', 'ip', 'lid']);

      // 5th lead should be the last one created
      assert.isObject(res.body[4]);
      assert.deepEqual(res.body[4].lead, {
        firstname: 'Fred',
        lastname: 'Blogs',
        age: 27
      });
      assert.hasAnyKeys(res.body[4].system, ['created', 'ip', 'lid']);


      // keep a copy of the lead ids
      for (const item of res.body) {
        leadIds.push(item.system.lid);
      }
      done();
    });
  });

  it('QueryLeads: should get leads orderBy system.created ascending limit 2', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=asc&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=asc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=asc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=desc&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=desc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
    .get(`/projects/${newPid}/leads?orderBy=system_created&orderDirection=desc&startAfter=${startAfter}&limit=2`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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

  it('GetLead: should get a single lead by ID', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newPid}/leads/${leadIds[1]}`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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
      assert.strictEqual(res.body.system.lid, leadIds[1]);
      done();
    });
  });

  it(`GetLead: should fail to get a lead by incorrect lead ID`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newPid}/leads/notthere`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
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

  it(`DeleteProject: should delete project '${newPid}'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .delete(`/projects/${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('x-capturoo-app-version', APP_VERSION)
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

  it('QueryLeads: should query leads order by default (created desc)', function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
    .get(`/projects/${newPid}/leads`)
    .set('Content-Type', 'application/json')
    .set('x-access-token', token)
    .set('x-capturoo-timing', 'on')
    .set('x-capturoo-version', 'on')
    .expect('x-capturoo-app-version', APP_VERSION)
    .expect(200)
    .end(function(err, res) {
      if (err) {
        console.error(res.text);
        return done(err);
      }

      assert.isArray(res.body);
      assert.isEmpty(res.body);
      done();
    });
  });

  it(`DeleteProject: should fail to delete project '${newPid}' as it just got deleted`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .delete(`/projects/${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('x-capturoo-app-version', APP_VERSION)
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

  it(`GetProject: should fail to get the previously deleted project '${newPid}'`, function(done) {
    this.timeout(TIMEOUT_MS);
    request(endpoint)
      .get(`/projects/${newPid}`)
      .set('Content-Type', 'application/json')
      .set('x-access-token', token)
      .set('x-capturoo-timing', 'on')
      .set('x-capturoo-version', 'on')
      .expect('Content-Type', /application\/json/)
      .expect('x-capturoo-app-version', APP_VERSION)
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
    auth.signOut()
      .then(() => {
        done();
      })
      .catch(err => {
        done(err);
      });
  });
});
