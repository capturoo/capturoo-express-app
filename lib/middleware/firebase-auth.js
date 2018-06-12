const admin = require('firebase-admin');

const auth = function(config) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.credentials),
      databaseURL: config.database.url
    });
  }

  return function(req, res, next) {
    // If x-api-key is set, then authentication has already been dealt with
    if (req.headers['x-api-key']) {
      return next();
    }

    let auth = admin.auth();
    let firebaseJwt = req.headers['x-access-token'];

    if (!firebaseJwt) {
      res.status(403);
      res.json({
        status: 403,
        message: 'x-access-token not set'
      });
      return;
    }

    return auth.verifyIdToken(firebaseJwt)
      .then(decodedIdToken => {
        return admin.firestore().collection('accounts').doc(decodedIdToken.uid).get();
      })
      .then(docSnap => {
        if (!docSnap.exists) {
          res.status(401);
          return res.json({
            status: 401,
            message: 'Failed to authenticate'
          });
        }

        res.locals.aid = docSnap.id;
        res.locals.accountObj = docSnap.data();
        res.locals.accountDocRef = docSnap._ref;
        next();
      })
      .catch(err => {
        if (err.codePrefix && err.codePrefix === 'auth') {
          return next(Error('auth/failed'));
        }
        next(Error('auth/failed'));
      });
  };
};

module.exports = auth;
