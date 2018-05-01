'use strict';
const admin = require('firebase-admin');

const auth = function(serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://leads-dashboard-staging.firebaseio.com'
    });
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

    admin.firestore()
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
