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
    let db = admin.firestore();
    let xApiKeyBase64 = req.headers['x-api-key'];

    if (xApiKeyBase64 === undefined) {
      return res.status(400).json({
        status: 400,
        message: 'X-API-Key undefined'
      });
    }

    let xApiKey = Buffer.from(xApiKeyBase64, 'base64').toString('ascii');
    let [accountId, publicApiKey]  = xApiKey.split(':');

    if (!accountId || !publicApiKey) {
      return res.status(401).json({
        status: 401,
        message: `X-API-Key invalid public key`
      });
    }

    db.collection('accounts').doc(accountId).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        return res.status(401).json({
          status: 401,
          message: `X-API-Key invalid public key`
        });
      }

      res.locals.accountId = docSnap.id;
      res.locals.accountObj = docSnap._ref;

      return db.collection(`accounts/${accountId}/projects`)
      .where('publicApiKey', '==', publicApiKey)
      .get();
    })
    .then(querySnapshot => {
      if (!Array.isArray(querySnapshot.docs) || !querySnapshot.docs.length) {
        res.status(401);
        res.json({
          status: 401,
          message: `X-API-Key=${accountId}:${publicApiKey} is not a valid public key`
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
      next(err);
    });
  };
};

module.exports = auth;
