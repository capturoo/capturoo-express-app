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
    let privateApiKey = req.headers['x-api-key'];

    if (privateApiKey === undefined) {
      res.status(400);
      res.json({
        status: 400,
        message: 'X-API-Key undefined'
      });
      return;
    }

    admin.firestore()
      .collection('accounts')
      .where('privateApiKey', '==', privateApiKey)
      .get()
      .then(querySnapshot => {
        if (!Array.isArray(querySnapshot.docs) || !querySnapshot.docs.length) {
          res.status(401);
          res.json({
            status: 401,
            message: `X-API-Key=${privateApiKey} is not a valid private key`
          });
          res.end();
          return;
        }

        if (!querySnapshot.empty && Array.isArray(querySnapshot.docs)
          && querySnapshot.docs.length === 1) {
            res.locals.accountId = querySnapshot.docs[0].id;
            res.locals.accountObj = querySnapshot.docs[0].data();
            res.locals.accountDocRef = querySnapshot.docs[0]._ref;
            next();
        } else {
          res.status(401);
          res.json({
            status: 401,
            message: `X-API-Key invalid private key`
          });
        }
      })
      .catch(err => {
        console.error(err);
        next(err);
      })
  };
};

module.exports = auth;
