'use strict';
const pkg = require('../package.json');
const APP_VERSION = pkg.version;
const express = require('express');
const cors = require('cors');
const validate = require('express-jsonschema').validate;
const bodyParser = require('body-parser');
const publicAuth = require('./middleware/public-auth');
const privateAuth = require('./middleware/private-auth');
const firebaseAuth = require('./middleware/firebase-auth');
const Service = require('./services/service');

function ExpressApp(config) {
  const app = express();
  const service = new Service(config);

  // Create a json schema
  const LeadSchema = {
    type: 'object',
    properties: {
      tracking: {
        type: 'object',
        required: false
      },
      system: {
        type: 'object',
        required: true
      },
      lead: {
        type: 'object',
        required: true
      }
    },
    additionalProperties: false
  };

  const NewProjectSchema = {
    type: 'object',
    properties: {
      pid: {
        type: 'string',
        required: true
      },
      projectName: {
        type: 'string',
        required: true
      }
    },
    additionalProperties: false
  };

  const SignUpSchema = {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        required: true
      },
      password: {
        type: 'string',
        required: true
      },
      displayName: {
        type: 'string',
        required: false
      }
    },
    additionalProperties: false
  };

  app.disable('x-powered-by');
  app.use(cors({
    origin: true
  }));
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    if (req.headers['x-capturoo-timing']
      && req.headers['x-capturoo-timing'].trim().toLowerCase() === 'on') {
      res.locals.timing = true;
    } else {
      res.locals.timing = false;
    }

    if (req.headers['x-capturoo-version']
      && req.headers['x-capturoo-version'].trim().toLowerCase() === 'on') {
      res.set('x-capturoo-app-version', APP_VERSION);
    }
    next();
  });

  app.post('/signup', validate({ body: SignUpSchema }), (req, res) => {
    service.signUp(req.body.email, req.body.password, req.body.displayName)
      .then(userRecord => {
        let data = {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          created: new Date(userRecord.metadata.creationTime).toISOString()
        };
        res.status(201);
        res.json(data);
      })
      .catch(err => {
        console.error(err);
        res.status(400);
        res.json({
          status: 400,
          message: 'signup/failed'
        });
      });
  });

  // CreateLead
  app.post('/leads', publicAuth(config), validate({ body: LeadSchema }), (req, res) => {
    let system = req.body.system;
    Object.assign(system, {
      ip: req.ip
    });

    let tracking = {};
    Object.assign(tracking, req.body.tracking);
    let lead = req.body.lead;

    service.createLead(res.locals.aid, res.locals.pid, {
      system,
      tracking,
      lead
    })
    .then(({ system, data }) => {
      if (res.locals.timing) {
        res.set('x-capturoo-firebase-timing', system.firestoreMs);
      }
      res.status(201).json(data);
    })
    .catch(err => {
      console.error(err);
      res.status(400);
      res.json({
        status: 400,
        message: `Failed to add lead`
      });
    });
  });

  // DeleteLead
  app.delete('/projects/:pid/leads/:lid', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.deleteLead(res.locals.aid, req.params.pid, req.params.lid)
    .then(({ system }) => {
      if (res.locals.timing) {
        res.set('x-capturoo-firebase-timing', system.firestoreMs);
      }
      res.status(204).end();
    })
    .catch(err => {
      if (err.message === 'projects/project-not-found') {
        return res.status(404).json({
          status: 404,
          message: err.message
        });
      } else if (err.message === 'leads/lead-not-found') {
        return res.status(404).json({
          status: 404,
          message: err.message
        });
      }
      console.error(err);
      res.status(500).json(err);
    });
  });

  // GetProject
  app.get('/projects/:pid', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.getProject(res.locals.aid, req.params.pid)
      .then(({ system, project }) => {
        if (res.locals.timing) {
          res.set('x-capturoo-firebase-timing', system.firestoreMs);
        }
        return res.status(200).json(project);
      })
      .catch(err => {
        if (err.message === 'projects/project-not-found') {
          return res.status(404).json({
            status: 404,
            message: err.message
          });
        }
        return res.status(500).end();
      });
  });

  // CreateProject
  app.post('/projects', privateAuth(config),
    firebaseAuth(config), validate({ body: NewProjectSchema }), (req, res) => {
      return service.createProject(res.locals.aid, req.body.pid, req.body.projectName)
      .then(({ system, project }) => {
        if (res.locals.timing) {
          res.set('x-capturoo-firebase-timing', system.firestoreMs);
        }
        res.status(201).json(project);
      })
      .catch(err => {
        res.status(409).json({
          status: 409,
          message: err.message
        });
      });
  });

  // GetAccount
  app.get('/account', privateAuth(config), firebaseAuth(config), (req, res) => {
    let account = res.locals.accountObj;
    return res.status(200).json({
      aid: res.locals.aid,
      email: account.email,
      displayName: account.displayName,
      privateApiKey: account.privateApiKey,
      created: account.created,
      lastModified: account.lastModified
    });
  });

  //app.patch('/projects/:pid', privateAuth(config), firebaseAuth(config), (req, res) => {
  //
  //});

  // DeleteProject
  app.delete('/projects/:pid', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.deleteProject(res.locals.aid, req.params.pid)
      .then(() => {
        res.status(204).end();
      })
      .catch(err => {
        if (err.message === 'projects/project-not-found') {
          return res.status(404).json({
            status: 404,
            message: err.message
          });
        }
        res.status(500).send(err);
      });
  });

  // GetLead
  app.get('/projects/:pid/leads/:lid', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.getLead(res.locals.aid, req.params.pid, req.params.lid)
      .then(({ system, lead }) => {
        if (res.locals.timing) {
          res.set('x-capturoo-firebase-timing', system.firestoreMs);
        }

        return res.status(200).json(lead);
      })
      .catch(err => {
        if (err.message === 'leads/lead-not-found') {
          return res.status(404).json({
            status: 404,
            message: err.message
          });
        }
        console.log(err);
        return res.status(500).end();
      });
  });

  // QueryLeads
  app.get('/projects/:pid/leads', privateAuth(config), firebaseAuth(config), (req, res) => {
    let options = {};
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit);
    }

    if (req.query.orderBy) {
      options.orderBy = req.query.orderBy;
    }

    if (req.query.orderDirection) {
      options.orderDirection = req.query.orderDirection;
    }

    if (req.query.startAfter) {
      options.startAfter = req.query.startAfter;
    }

    service.getLeads(res.locals.aid, req.params.pid, options)
      .then(({ system, leads }) => {
        if (res.locals.timing) {
          res.set('x-capturoo-firebase-timing', system.firestoreMs);
        }
        return res.status(200).json(leads);
      })
      .catch(err => {
        if (err.code === 'leads/invalid-query-options') {
          return res.status(409).json({
            status: 409,
            code: err.code,
            message: err.message
          });
        }

        console.error(err);
        return res.status(500).json(err);
      });
  });

  // ListProjects
  app.get('/projects', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.getProjects(res.locals.aid)
      .then(({ system, projects }) => {
        if (res.locals.timing) {
          res.set('x-capturoo-firebase-timing', system.firestoreMs);
        }
        return res.status(200).json(projects);
      })
      .catch(err => {
        res.status(400);
        res.json({
          status: 400,
          message: ''
        });
      });
  });

  app.use(function(err, req, res, next) {
    if (err.name === 'JsonSchemaValidation') {
      res.status(400);
      res.json({
        status: 400,
        message: 'api/bad-request',
        info: {
          jsonSchemaValidation: true,
          validations: err.validations
        }
      });
    } else if (err.message === 'auth/failed') {
      res.status(401).json({
        status: 401,
        message: 'auth/failed'
      });
    } else {
      // pass error to next error middleware handler
      next(err);
    }
  });

  return app;
}


module.exports = ExpressApp;
