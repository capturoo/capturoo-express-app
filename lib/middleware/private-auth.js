'use strict';
const admin = require('firebase-admin');

const auth = function(config) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.credentials),
      databaseURL: config.database.url
    });
  }

  return function(req, res, next) {
    // if we have a Firebase JWT then skip to the next handler
    let firebaseJwt = req.headers['x-access-token'];
    if (firebaseJwt) {
      return next();
    }

    let privateApiKey = req.headers['x-api-key'];
    if (!privateApiKey) {
      res.status(403);
      return res.json({
        status: 403,
        message: 'auth/missing-api-key-or-token'
      });
    }

    admin.firestore()
      .collection('accounts')
      .where('privateApiKey', '==', privateApiKey)
      .get()
      .then(querySnapshot => {
        if (!Array.isArray(querySnapshot.docs) || !querySnapshot.docs.length) {
          res.status(401);
          return res.json({
            status: 401,
            message: `X-API-Key=${privateApiKey} is not a valid private key`
          });
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
        next(err);
      });
  };
};

module.exports = auth;
