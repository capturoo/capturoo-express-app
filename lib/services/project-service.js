'use strict';
const firebase = require('firebase');
const firestore = require('firebase/firestore');
const config = require('../../config');
const settings = {
  timestampsInSnapshots: true
};

const projectService = function() {
  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebase);
    firebase.firestore().settings(settings);
  }

  return function addLead(projectId, lead) {
    return new Promise(function(resolve, reject) {
      firebase.firestore()
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
};


module.exports = projectService;
