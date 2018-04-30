'use strict';
const admin = require('firebase-admin');
const serviceAccount = require('../../credentials.json');

function Service() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://leads-dashboard-staging.firebaseio.com'
    });
  }
}

Service.prototype.getProjects = function getProjects(accountId) {
  return new Promise(function(resolve, rejects) {
    admin.firestore()
      .collection('projects')
      .where('accountId', '==', accountId)
      .get()
      .then(snapshot => {
        resolve(snapshot);
      })
      .catch(err => {
        console.error('Error getting documents', err);
        reject(err);
      });
  });
}

Service.prototype.getLeads = function getLeads(projectId) {
  return new Promise(function(resolve, reject) {
    admin.firestore()
      .collection('leads-' + projectId)
      .get()
      .then(querySnapshot => {
        resolve(querySnapshot);
      })
      .catch(err => {
        console.error('Error getting leads', err);
        reject(err);
      });
  });
}

Service.prototype.addLead = function addLead(projectId, lead) {
  return new Promise(function(resolve, reject) {
    admin.firestore()
      .collection('leads-' + projectId)
      .add(lead)
      .then(docRef => {
        console.log(docRef);
        resolve(docRef);
      })
      .catch(err => {
        console.error(err);
        reject(err);
      });
  });
};

module.exports = Service;
