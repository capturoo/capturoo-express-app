'use strict';
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
      trackingData: {
        type: 'object',
        required: false
      },
      systemData: {
        type: 'object',
        required: true
      },
      leadData: {
        type: 'object',
        required: true
      }
    },
    additionalProperties: false
  };

  const NewProjectSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        required: true
      },
      projectId: {
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

  app.post('/leads', publicAuth(config), validate({ body: LeadSchema }), (req, res) => {
    let systemData = req.body.systemData;
    Object.assign(systemData, {
      ip: req.ip
    });

    let trackingData = {};
    Object.assign(trackingData, req.body.trackingData);
    let leadData = req.body.leadData;

    service.addLead(res.locals.projectId, {
      systemData,
      trackingData,
      leadData
    })
    .then(({ leadsCount, leadDocRef }) => {
      return leadDocRef.get();
    })
    .then(docSnap => {
      let data = docSnap.data();
      Object.assign(data, {
        id: docSnap.id
      });
      res.status(201);
      res.json(data);
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
  
  app.get('/projects/:projectId', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.getProject(req.params.projectId)
      .then(project => {
        res.status(200);
        res.json(project);
      })
      .catch(err => {
        res.status(404);
        res.json({
          status: 404,
          message: err.message
        });
      });
  });

  app.post('/projects', privateAuth(config), firebaseAuth(config), validate({ body: NewProjectSchema }), (req, res) => {
    return service.createProject(res.locals.accountId, req.body.name, req.body.projectId)
      .then(project => {
        res.status(201);
        res.json(project);
      })
      .catch(err => {
        res.status(409);
        res.json({
          status: 409,
          message: err.message
        });
      });
  });

  app.get('/account', privateAuth(config), firebaseAuth(config), (req, res) => {
    let account = res.locals.accountObj;
    res.status(200);
    res.json({
      accountId: res.locals.accountId,
      email: account.email,
      created: account.created,
      lastModified: account.lastModified
    });
  });

  //app.patch('/projects/:projectId', privateAuth(config), firebaseAuth(config), (req, res) => {
  //  
  //});

  app.delete('/projects/:projectId', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.deleteProject(req.params.projectId)
      .then(() => {
        res.status(204).end();
      })
      .catch(err => {
        res.status(500).send(err);
      });
  });

  app.get('/projects/:projectId/leads', privateAuth(config), (req, res) => {
    let options = {
      projectId: req.params.projectId
    };

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

    service.getLeads(options)
      .then(querySnapshot => {
        let leads = [];
        querySnapshot.forEach(doc => {
          let l = doc.data();
          Object.assign(l, {
            leadId: doc.id
          });
          leads.push(l);
        });
        res.status(200);
        res.json(leads);
      })
      .catch(err => {
        console.error(err);
      });
  });

  app.get('/projects', privateAuth(config), firebaseAuth(config), (req, res) => {
    service.getProjects(res.locals.accountId)
      .then(projects => {
        res.status(200);
        res.json(projects);
      })
      .catch(err => {
        console.error(err);
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
        statusText: 'Bad Request',
        jsonSchemaValidation: true,
        validations: err.validations
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
