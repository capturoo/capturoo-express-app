const admin = require('firebase-admin');

function Service(config) {
  if (config) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(config.credentials),
        databaseURL: config.database.url
      });
      admin.firestore().settings({
        timestampsInSnapshots: true
      });
    }
  } else {
    // if config is not set, then we're most likely running as a GCF in the
    // cloud platform environment, so we will use the default
    admin.initializeApp();
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
 * @param {string} aid
 * @param {string} pid
 * @param {string} projectName
 * @returns {Promise.<ProjectInfo>}
 */
Service.prototype.createProject = function createProject(aid, pid, projectName) {
  return new Promise(function(resolve, reject) {
    var ts = process.hrtime();
    let docRef = admin.firestore().doc(`accounts/${aid}/projects/${pid}`);
    docRef.get()
      .then(docSnap => {
        if (docSnap.exists) {
          reject(Error('projects/project-id-taken'));
        }

        const crypto = require('crypto');
        return docRef.set({
          projectName,
          publicApiKey: (function () {
            let base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let str = '';
            // only need 6 characters to make this unqiue within a
            // subcollection of a project document
            for (let b of crypto.randomBytes(6)) {
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
            pid: docSnap.id,
            aid: data.aid,
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
 * @property {string} project.pid
 * @property {string} project.aid
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
 * @param {string} aid
 * @param {string} pid
 * @returns {Promise.<ProjectInfo>}
 */
Service.prototype.getProject = function getProject(aid, pid) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().doc(`accounts/${aid}/projects/${pid}`).get()
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
            pid: docSnap.id,
            aid: data.aid,
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

Service.prototype.getProjects = function getProjects(aid) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();

    admin.firestore().collection(`accounts/${aid}/projects`)
      .get()
      .then(snapshot => {
        let projects = [];
        snapshot.forEach(doc => {
          let p = doc.data();
          Object.assign(p, { pid: doc.id });
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
 * @param {string} aid
 * @param {string} pid
 * @returns {Promise.<undefined>}
 */
Service.prototype.deleteProject = function deleteProject(aid, pid) {
  return new Promise((resolve, reject) => {
    let docRef = admin.firestore().doc(`accounts/${aid}/projects/${pid}`);
    this.deleteLeads(aid, pid)
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
 * @param {string} aid
 * @param {string} pid
 * @returns {Promise.<undefined>}
 */
Service.prototype.deleteLeads = function deleteLeads(aid, pid) {
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
    let leadsCollection = db.collection(`accounts/${aid}/projects/${pid}/leads`);
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
 * @param {string} aid
 * @param {string} pid
 * @param {string} lid
 * @returns {Promise.<lead>}
 */
Service.prototype.getLead = function getLead(aid, pid, lid) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().collection(`accounts/${aid}/projects/${pid}/leads`).doc(lid).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        reject(Error('leads/lead-not-found'));
      }

      let lead = docSnap.data();
      lead = Object.assign(lead, {
        system: Object.assign(lead.system, {
          lid: docSnap.id
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
 * @param {string} aid
 * @param {string} pid
 * @param {object} options
 * @param {string} options.pid the project ID
 * @param {string} [options.orderBy] sort order accepts ['created'] defaults to 'created'
 * @param {string} [options.orderDirection] direction of sort accepts ['asc', 'desc] defaults to 'asc'
 * @param {string} [options.startAfter] results start after the provided document (exclusive)
 * @see https://firebase.google.com/docs/reference/js/firebase.firestore.Query#startAfter
 * @returns {Promise.<firebase.firestore.QuerySnapshot>}
 */
Service.prototype.getLeads = function getLeads(aid, pid, options) {
  return new Promise(function(resolve, reject) {
    let opts = options || {};

    if (opts && typeof opts !== 'object') {
      reject(Error('options should by an object'));
    }

    if (pid && (typeof pid !== 'string')) {
      reject(TypeError('pid must be of type string'));
    }

    if (opts.orderBy) {
      let regex = /^[a-z0-9_]+$/gi;
      if (!regex.test(opts.orderBy)) {
        let e = RangeError('options.orderBy must use only [a-zA-z0-9_] characters');
        e.code = 'leads/invalid-query-options';
        reject(e);
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
    let colRef = admin.firestore().collection(`accounts/${aid}/projects/${pid}/leads`);

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
            lid: doc.id
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
 * @param {string} aid
 * @param {string} pid
 * @param {object} lead
 */
Service.prototype.createLead = function createLead(aid, pid, lead) {
  var ts = process.hrtime();
  let db = admin.firestore();

  let projectRef = db.doc(`accounts/${aid}/projects/${pid}`);
  let leadsCollection = db.collection(`accounts/${aid}/projects/${pid}/leads`);

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
              created: admin.firestore.FieldValue.serverTimestamp()
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
        lid: docSnap.id
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
 * @param {string} aid
 * @param {string} pid
 * @param {string} lid
 * @returns {Promises.<undefined>}
 */
Service.prototype.deleteLead = function deleteLead(aid, pid, lid) {
  var ts = process.hrtime();
  let db = admin.firestore();

  return db.runTransaction(t => {
    let projectRef = db.doc(`accounts/${aid}/projects/${pid}`);
    let leadRef = db.collection(`accounts/${aid}/projects/${pid}/leads`).doc(lid);

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
