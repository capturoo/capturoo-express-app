'use strict';
const firebase = require('firebase');
const firestore = require('firebase/firestore');
const config = require('../../config');
const settings = {
  timestampsInSnapshots: true
};

const auth = function() {
  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebase);
    firebase.firestore().settings(settings);
  }

  return function(req, res, next) {
    let publicApiKey = req.headers['x-api-key'];

    if (publicApiKey === undefined) {
      res.status(400);
      res.json({
        status: 400,
        message: 'X-API-Key undefined'
      });
      return;
    }

    firebase.firestore()
      .collection('projects')
      .where('publicApiKey', '==', publicApiKey)
      .get()
      .then(querySnapshot => {
        if (!Array.isArray(querySnapshot.docs) || !querySnapshot.docs.length) {
          res.status(401);
          res.json({
            status: 401,
            message: `X-API-Key=${publicApiKey} is not a valid public key`
          });
          return;
        }

        if (!querySnapshot.empty && Array.isArray(querySnapshot.docs)
          && querySnapshot.docs.length === 1) {
            res.locals.projectId = querySnapshot.docs[0].id;
            res.locals.projectObj = querySnapshot.docs[0].data();
            next();
        } else {
          res.status(401);
          res.json({
            status: 401,
            message: `X-API-Key invalid public key`
          });
        }
      })
      .catch(err => {
        console.error(err);
        next(err);
      });
  };
};

module.exports = auth;
