'use strict';
const admin = require('firebase-admin');

function Service(serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://leads-dashboard-staging.firebaseio.com'
    });
  }
}

Service.prototype.createProject = function createProject(accountId, name, projectId) {
  return new Promise(function(resolve, reject) {
    console.log('projectId=' + projectId);
    var ts = process.hrtime();
    let docRef = admin.firestore().collection('projects').doc(projectId);

    docRef.get()
      .then(docSnap => {
        if (docSnap.exists) {
          reject(Error('Project ID takenn'));
        }

        const crypto = require('crypto');
        docRef.set({
          accountId: accountId,
          name,
          publicApiKey: (function () {
            let base62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let str = '';
            // 62^43 > 2^256 so 43 characters is greater than 256 bit entropy
            for (let b of crypto.randomBytes(22)) {
              str += base62[b % 62];
            };
            return str;
          })(),
          created: admin.firestore.FieldValue.serverTimestamp(),
          lastModified: admin.firestore.FieldValue.serverTimestamp()
        });
        //console.log(docSnap);

        return docRef.get();
      })
      .then(docSnap => {
        let data = docSnap.data();

        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        console.log(`createProject took ${ms}ms to complete.`);

        resolve({
          projectId: docSnap.id,
          accountId: data.accountId,
          name: data.name,
          publicApiKey: data.publicApiKey,
          created: data.created,
          lastModified: data.lastModified
        });
      })
      .catch(err => {
        reject(err);
      });
  });
}

Service.prototype.getProjects = function getProjects(accountId) {
  return new Promise(function(resolve, rejects) {
    var ts = process.hrtime();
    admin.firestore().collection('projects')
      .where('accountId', '==', accountId)
      .get()
      .then(snapshot => {
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        console.log(`getProjects took ${ms}ms to complete.`);
        resolve(snapshot);
      })
      .catch(err => {
        console.error('Error getting documents', err);
        reject(err);
      });
  });
};

Service.prototype.getLeads = function getLeads(projectId) {
  return new Promise(function(resolve, reject) {
    var ts = process.hrtime();
    admin.firestore().collection('leads-' + projectId)
      .get()
      .then(querySnapshot => {
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        console.log(`getLeads took ${ms}ms to complete.`);
        resolve(querySnapshot);
      })
      .catch(err => {
        console.error('Error getting leads', err);
        reject(err);
      });
  });
};

Service.prototype.addLead = function addLead(projectId, lead) {
  return new Promise(function(resolve, reject) {
    var ts = process.hrtime();
    admin.firestore().collection('leads-' + projectId)
      .add(lead)
      .then(docRef => {
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        console.log(`addLead took ${ms}ms to complete.`);
        resolve(docRef);
      })
      .catch(err => {
        console.error(err);
        reject(err);
      });
  });
};

module.exports = Service;
