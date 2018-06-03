const admin = require('firebase-admin');

function Service(config) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.credentials),
      databaseURL: config.database.url
    });
  }
}

/**
 * Creates a new Firebase user account
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise.<admin.auth.UserRecord>}
 * @see https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth#createUser
 * @see https://firebase.google.com/docs/reference/admin/node/admin.auth.UserRecord
 */
Service.prototype.signUp = (email, password, displayName) => {
  return new Promise((resolve, reject) => {
    let createRequest = {
      disabled: false,
      displayName,
      email,
      emailVerfied: false,
      password
    };
    admin.auth().createUser(createRequest)
      .then(userRecord => {
        return resolve(userRecord)
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * CreateProject: Creates a new project inside the given account
 * @param {string} accounId
 * @param {string} projectId
 * @param {string} projectName
 * @returns {Promise.<ProjectInfo>}
 */
Service.prototype.createProject = function createProject(accountId, projectId, projectName) {
  return new Promise(function(resolve, reject) {
    var ts = process.hrtime();
    let docRef = admin.firestore().doc(`accounts/${accountId}/projects/${projectId}`);
    docRef.get()
      .then(docSnap => {
        if (docSnap.exists) {
          reject(Error('projects/project-id-taken'));
        }

        const crypto = require('crypto');
        return docRef.set({
          accountId,
          projectName,
          publicApiKey: (function () {
            let base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let str = '';
            // 62^43 > 2^256 so 43 characters is greater than 256 bit entropy
            for (let b of crypto.randomBytes(22)) {
              str += base62[b % 62];
            };
            return str;
          })(),
          leadsCount: 0,
          created: admin.firestore.FieldValue.serverTimestamp(),
          lastModified: admin.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(() => {
        return docRef.get();
      })
      .then(docSnap => {
        let data = docSnap.data();

        let [s, ns] = process.hrtime(ts);
        resolve({
          system: {
            firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
          },
          project: {
            projectId: docSnap.id,
            accountId: data.accountId,
            projectName: data.projectName,
            publicApiKey: data.publicApiKey,
            leadsCount: data.leadsCount,
            created: data.created,
            lastModified: data.lastModified
          }
        });
      })
      .catch(err => {
        reject(err);
      });
  });
}

/**
 * Get a project from an account by project ID
 * @typedef {object} System
 * @property {string} system.firestoreMs
 *
 * @typedef {object} ProjectData
 * @property {string} project.projectId
 * @property {string} project.accountId
 * @property {string} project.projectName
 * @property {number} project.leadsCount
 * @property {string} project.privateApiKey
 * @property {Date}   project.created
 * @property {Date}   project.lastModified
 *
 * @typedef {object} ProjectInfo
 * @property {System} system
 * @property {ProjectData} project
 *
 * @param {string} accountId
 * @param {string} projectId
 * @returns {Promise.<ProjectInfo>}
 */
Service.prototype.getProject = function getProject(accountId, projectId) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().doc(`accounts/${accountId}/projects/${projectId}`).get()
      .then(docSnap => {
        if (!docSnap.exists) {
          reject(Error('projects/project-not-found'));
        }

				let data = docSnap.data();
        let [s, ns] = process.hrtime(ts);
        resolve({
          system: {
            firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
          },
          project: {
            projectId: docSnap.id,
            accountId: data.accountId,
            projectName: data.projectName,
            leadsCount: data.leadsCount,
            publicApiKey: data.publicApiKey,
            created: data.created,
            lastModified: data.lastModified
          }
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

Service.prototype.getProjects = function getProjects(accountId) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();

    admin.firestore().collection(`accounts/${accountId}/projects`)
      .get()
      .then(snapshot => {
        let projects = [];
        snapshot.forEach(doc => {
          let p = doc.data();
          Object.assign(p, { projectId: doc.id });
          projects.push(p);
        })
        let [s, ns] = process.hrtime(ts);
        resolve({
          system: {
            firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
          },
          projects
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * DeleteProject: Delete a project
 * @param {string} accountId
 * @param {string} projectId
 * @returns {Promise.<undefined>}
 */
Service.prototype.deleteProject = function deleteProject(accountId, projectId) {
  return new Promise((resolve, reject) => {
    let docRef = admin.firestore().doc(`accounts/${accountId}/projects/${projectId}`);
    this.deleteLeads(accountId, projectId)
      .then(() => {
        return docRef.get();
      })
      .then(docSnap => {
        if (!docSnap.exists) {
          return reject(Error('projects/project-not-found'));
        }
        return docRef.delete();
      })
      .then(() => {
        return resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Delete all leads from a given account and project
 * @param {string} accountId
 * @param {string} projectId
 * @returns {Promise.<undefined>}
 */
Service.prototype.deleteLeads = function deleteLeads(accountId, projectId) {
  function deleteQueryBatch(db, query, batchSize, resolve, reject) {
    query.get()
      .then(docSnap => {
        if (docSnap.size === 0) {
          return 0;
        }

        let batch = db.batch();
        docSnap.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        return batch.commit().then(() => {
          return docSnap.size;
        });
      })
      .then(numDeleted => {
        if (numDeleted === 0) {
          return resolve();
        }

        process.nextTick(() => {
          deleteQueryBatch(db, query, batchSize, resolve, reject);
        });
      })
      .catch(reject);
  }

  function deleteCollection(db, colRef, batchSize) {
    return new Promise((resolve, reject) => {
      let query = colRef.orderBy('__name__').limit(batchSize);
      deleteQueryBatch(db, query, batchSize, resolve, reject);
    });
  }

  return new Promise((resolve, reject) => {
    let db = admin.firestore();
    let leadsCollection = db.collection(`accounts/${accountId}/projects/${projectId}/leads`);
    deleteCollection(db, leadsCollection, 10)
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Get a lead by lead ID
 * @typedef {object} lead
 * @property {object} lead.system
 * @property {string} lead.system.host hostname
 * @param {string} accountId
 * @param {string} projectId
 * @param {string} leadId
 * @returns {Promise.<lead>}
 */
Service.prototype.getLead = function getLead(accountId, projectId, leadId) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().collection(`accounts/${accountId}/projects/${projectId}/leads`).doc(leadId).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        reject(Error('leads/lead-not-found'));
      }

      let lead = docSnap.data();
      lead = Object.assign(lead, {
        system: Object.assign(lead.system, {
          leadId: docSnap.id
        })
      });

      let [s, ns] = process.hrtime(ts);
      resolve({
        system: {
          firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
        },
        lead
      });
    })
    .catch(err => {
      reject(err);
    });
  });
};


/**
 * Retrieve a list of leads for a given project
 * @param {string} accountId
 * @param {string} projectId
 * @param {object} options
 * @param {string} options.projectId the project ID
 * @param {string} [options.orderBy] sort order accepts ['created'] defaults to 'created'
 * @param {string} [options.orderDirection] direction of sort accepts ['asc', 'desc] defaults to 'asc'
 * @param {string} [options.startAfter] results start after the provided document (exclusive)
 * @see https://firebase.google.com/docs/reference/js/firebase.firestore.Query#startAfter
 * @returns {Promise.<firebase.firestore.QuerySnapshot>}
 */
Service.prototype.getLeads = function getLeads(accountId, projectId, options) {
  return new Promise(function(resolve, reject) {
    let opts = options || {};

    if (opts && typeof opts !== 'object') {
      reject(Error('options should by an object'));
    }

    if (projectId && (typeof projectId !== 'string')) {
      reject(TypeError('projectId must be of type string'));
    }

    if (opts.orderBy) {
      //let numUnderscores = (temp.match(/_/g) || []).length;
      let regex = /^[a-z0-9_]+$/gi;
      if (!regex.test(opts.orderBy)) {
        reject(RangeError('options.orderBy must use only [a-zA-z0.9_] characters'));
      }
      opts.orderBy = opts.orderBy.replace(/_/g, $1 => { return '.'} );
    }

    if (opts.orderDirection && !['asc', 'desc'].includes(opts.orderDirection)) {
      reject(RangeError(`options.orderDirection must be either 'asc' or 'desc'`));
    }

    if (opts.startAfter && typeof opts.startAfter !== 'string') {
      reject(TypeError('options.startAfter should be a string type'));
    }

    if (opts.limit) {
      if (typeof opts.limit !== 'number' || isNaN(opts.limit)) {
        reject(TypeError('options.limit must be of type number'));
      } else if (opts.limit < 1) {
        reject(RangeError('options.limit must be a positive integer value'));
      }
    }

    var ts = process.hrtime();
    let colRef = admin.firestore().collection(`accounts/${accountId}/projects/${projectId}/leads`);

    // unless set the default order direction is oldest to newest leads;
    var orderBy = (opts.orderBy) ? opts.orderBy : 'system.created';
    var orderDirection = (opts.orderDirection) ? opts.orderDirection : 'desc';
    let query = colRef.orderBy(orderBy, orderDirection);

    // limit is an optional parameter
    if (opts.limit) {
      query = query.limit(opts.limit);
    }

    if (opts.startAfter) {
      query = query.startAfter(new Date(opts.startAfter));
    }

    query.get()
    .then(querySnapshot => {
      let leads = [];
      querySnapshot.forEach(doc => {
        let l = doc.data();
        Object.assign(l, {
          system: Object.assign(l.system, {
            leadId: doc.id
          })
        });
        leads.push(l);
      });

      let [s, ns] = process.hrtime(ts);
      resolve({
        system: {
          firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
        },
        leads
      });
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * CreateLead: Create a new lead
 * @param {string} accountId
 * @param {string} projectId
 * @param {object} lead
 */
Service.prototype.createLead = function createLead(accountId, projectId, lead) {
  var ts = process.hrtime();
  let db = admin.firestore();

  let projectRef = db.doc(`accounts/${accountId}/projects/${projectId}`);
  let leadsCollection = db.collection(`accounts/${accountId}/projects/${projectId}/leads`);

  return db.runTransaction(t => {
    return t.get(projectRef)
      .then(docSnap => {
        let newLeadsCount = docSnap.data().leadsCount + 1;
        let leadDocRef = leadsCollection.doc();

        t.update(projectRef, {
          leadsCount: newLeadsCount
        });

        let data = Object.assign(lead, {
          system: Object.assign(lead.system, {
              created: admin.firestore.FieldValue.serverTimestamp(),
              leadNum: newLeadsCount
          })
        });
        t.set(leadDocRef, data);

        return {
          leadsCount: newLeadsCount,
          leadDocRef
        };
      });
  })
  .then(({ leadsCount, leadDocRef }) => {
    return leadDocRef.get();
  })
  .then(docSnap => {
    let data = docSnap.data();

    data = Object.assign(data, {
      system: Object.assign(data.system, {
        leadId: docSnap.id
      })
    });
    return data;
  })
  .then(data => {
    let [s, ns] = process.hrtime(ts);
    return Promise.resolve({
      system: {
        firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
      },
      data
    });
  }).catch(err => {
    return Promise.reject(err);
  });
};

/**
 * DeleteLead: Delete a lead for a given account and project
 * @param {string} accountId
 * @param {string} projectId
 * @param {string} leadId
 * @returns {Promises.<undefined>}
 */
Service.prototype.deleteLead = function deleteLead(accountId, projectId, leadId) {
  var ts = process.hrtime();
  let db = admin.firestore();

  return db.runTransaction(t => {
    let projectRef = db.doc(`accounts/${accountId}/projects/${projectId}`);
    let leadRef = db.collection(`accounts/${accountId}/projects/${projectId}/leads`).doc(leadId);

    return t.get(projectRef)
    .then(queryDocSnap => {
      let data = queryDocSnap.data();
      if (!data) {
        throw Error('projects/project-not-found');
      }
      return t.get(leadRef);
    })
    .then(queryDocSnap => {
      // SHOULD RETURN A DocumentSnapshot
      let data = queryDocSnap.data();
      if (!data) {
        throw Error('leads/lead-not-found');
      }
      return t.get(projectRef);
    })
    .then(queryDocSnap => {
      t.update(projectRef, {
        leadsCount: queryDocSnap.data().leadsCount - 1
      });
      t.delete(leadRef);
    });
  })
  .then(() => {
    let [s, ns] = process.hrtime(ts);
    return Promise.resolve({
      system: {
        firestoreMs: Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0)
      }
    });
  })
  .catch(err => {
    return Promise.reject(err);
  });;
};

module.exports = Service;
