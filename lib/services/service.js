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

Service.prototype.signup = function signup(email, password, displayName) {
  return new Promise(function(resolve, reject) {
    let auth = admin.auth();

    // check if the account already exists
    var ts = process.hrtime();
    auth.getUserByEmail(email)
      .then(userRecord => {
        return reject(Error('Account already exists'));
      })
      .catch(err => {
        // https://firebase.google.com/docs/reference/admin/node/admin.auth.CreateRequest
        auth.createUser({
          email,
          displayName,
          emailVerified: false,
          password,
        })
        .then(userRecord => {
          // https://firebase.google.com/docs/reference/admin/node/admin.auth.UserRecord
          let [s, ns] = process.hrtime(ts);
          let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
          console.log(`getUserByEmail took ${ms}ms to complete.`);
          resolve(userRecord);
        })
        .catch(err => {
          reject(err);
        });
      });
  });
};

Service.prototype.getProjects = function getProjects(accountId) {
  return new Promise(function(resolve, rejects) {
    var ts = process.hrtime();
    admin.firestore()
      .collection('projects')
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
    admin.firestore()
      .collection('leads-' + projectId)
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
    admin.firestore()
      .collection('leads-' + projectId)
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
