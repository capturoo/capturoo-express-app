'use strict';
const express = require('express');
const cors = require('cors');
const validate = require('express-jsonschema').validate;
const bodyParser = require('body-parser');
const publicAuth = require('./middleware/public-auth');
const privateAuth = require('./middleware/private-auth');
const Service = require('./services/service');
const app = express();

const service = new Service();

// Create a json scehma
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

app.disable('x-powered-by');
app.use(cors({
  origin: true
}));
app.use(bodyParser.json());

app.post('/leads', publicAuth(), validate({ body: LeadSchema }), function(req, res) {
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
  .then(docRef => {
    return docRef.get();
  })
  .then(documentSnapshot => {
    let data = documentSnapshot.data();
    Object.assign(data, {
      id: documentSnapshot.id
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

app.use(function(err, req, res, next) {
  if (err.name === 'JsonSchemaValidation') {
    res.status(400);
    res.json({
      statusText: 'Bad Request',
      jsonSchemaValidation: true,
      validations: err.validations
    });
  } else {
    // pass error to next error middleware handler
    next(err);
  }
});

app.get('/account', privateAuth(), function(req, res) {
  let account = res.locals.accountObj;
  res.status(200);
  res.json({
    accountId: res.locals.accountId,
    email: account. email,
    created: account.created,
    lastModified: account.lastModified
  });
});

app.get('/projects/:projectId/leads', privateAuth(), function(req, res) {
  service.getLeads(req.params.projectId)
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

app.get('/projects', privateAuth(), function(req, res) {
  service.getProjects(res.locals.accountId)
    .then(snapshot => {
      let projects = [];
      snapshot.forEach(doc => {
        let p = doc.data();
        Object.assign(p, { projectId: doc.id });
        projects.push(p);
      });
      res.status(200);
      res.json(projects);
    })
    .catch(err => {
      console.error(err);
    });
});

module.exports = app;
