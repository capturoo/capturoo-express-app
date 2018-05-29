const admin = require('firebase-admin');

const config = require('../config');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(config.credentials),
    databaseURL: config.database.url
  });
} 

(async () => {
  let colRef = await admin.firestore().collection('leads-wibble-12345');

  let docSnap = await colRef.get();

  console.log(`size is ${docSnap.size}`);

})();
