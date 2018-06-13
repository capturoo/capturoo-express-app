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
    let xApiKey = req.headers['x-api-key'];

    if (xApiKey === undefined || xApiKey.length !== 34) {
      return res.status(400).json({
        status: 400,
        message: 'X-API-Key undefined'
      });
    }

    // the first 6 characters are the key part
    // the remaining 28 character are the aid
    let publicApiKey = xApiKey.substr(0, 6);
    let aid = xApiKey.substr(6);

    if (!aid || !publicApiKey) {
      return res.status(401).json({
        status: 401,
        message: `X-API-Key invalid public key`
      });
    }

    db.collection('accounts').doc(aid).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        return res.status(401).json({
          status: 401,
          message: `X-API-Key invalid public key`
        });
      }

      res.locals.aid = docSnap.id;
      res.locals.accountObj = docSnap._ref;

      return db.collection(`accounts/${aid}/projects`)
      .where('publicApiKey', '==', publicApiKey)
      .get();
    })
    .then(querySnapshot => {
      if (!Array.isArray(querySnapshot.docs) || !querySnapshot.docs.length) {
        res.status(401);
        res.json({
          status: 401,
          message: `X-API-Key=${aid}:${publicApiKey} is not a valid public key`
        });
        return;
      }

      if (!querySnapshot.empty && Array.isArray(querySnapshot.docs)
        && querySnapshot.docs.length === 1) {
          res.locals.pid = querySnapshot.docs[0].id;
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
