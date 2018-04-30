'use strict';
const express = require('express');
const cors = require('cors');
const validate = require('express-jsonschema').validate;
const bodyParser = require('body-parser');
const auth = require('./middleware/auth');
const projectService = require('./services/project-service');
const app = express();

const addLead = projectService();

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
app.use(auth());

app.post('/leads', validate({ body: LeadSchema }), function(req, res) {
  let systemData = req.body.systemData;
  Object.assign(systemData, {
    ip: req.ip
  });

  let trackingData = {};
  Object.assign(trackingData, req.body.trackingData);
  let leadData = req.body.leadData;

  addLead(res.locals.projectId, {
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
    console.log(err.message);
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

module.exports = app;
