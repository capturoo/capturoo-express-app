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

Service.prototype.createProject = function createProject(accountId, name, projectId) {
  return new Promise(function(resolve, reject) {
    var ts = process.hrtime();
    let docRef = admin.firestore().collection('projects').doc(projectId);

    docRef.get()
      .then(docSnap => {
        if (docSnap.exists) {
          reject(Error('projects/project-id-taken'));
        }

        const crypto = require('crypto');
        return docRef.set({
          accountId: accountId,
          name,
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
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);

        resolve({
          system: {
            firestoreMs: ms
          },
          project: {
            projectId: docSnap.id,
            accountId: data.accountId,
            name: data.name,
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
}

Service.prototype.projectIdExists = function projectIdExists(projectId) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().collection('projects').doc(projectId).get()
      .then(docSnap => {
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        resolve({
          system: {
            firestoreMs: ms
          },
          exists: docSnap.exists
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

Service.prototype.getProject = function getProject(projectId) {
  return new Promise((resolve, reject) => {
    let ts = process.hrtime();
    admin.firestore().collection('projects').doc(projectId).get()
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
            name: data.name,
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
    var ts = process.hrtime();

    admin.firestore().collection('projects')
      .where('accountId', '==', accountId)
      .orderBy('created', 'desc')
      .get()
      .then(snapshot => {
        let projects = [];
        snapshot.forEach(doc => {
          let p = doc.data();
          Object.assign(p, { projectId: doc.id });
          projects.push(p);
        })
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        resolve({
          system: {
            firestoreMs: ms
          },
          projects
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

Service.prototype.deleteProject = function deleteProject(projectId) {
  return new Promise((resolve, reject) => {
    let docRef = admin.firestore().collection('projects').doc(projectId);
    this.deleteLeads(projectId)
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

Service.prototype.deleteLeads = function deleteLeads(projectId) {
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
    let leadsCollection = db.collection(`leads-${projectId}`);
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
 * Retrieve a list of leads for a given project
 * @param {object} options
 * @param {string} options.projectId the project ID
 * @param {string} [options.orderBy] sort order accepts ['created'] defaults to 'created'
 * @param {string} [options.orderDirection] direction of sort accepts ['asc', 'desc] defaults to 'asc'
 * @param {string} [options.startAfter] results start after the provided document (exclusive)
 * @see https://firebase.google.com/docs/reference/js/firebase.firestore.Query#startAfter
 * @returns {Promise.<firebase.firestore.QuerySnapshot>}
 */
Service.prototype.getLeads = function getLeads(options) {
  return new Promise(function(resolve, reject) {
    let opts = options || {};

    if (opts && typeof opts !== 'object') {
      reject(Error('options should by an object'));
    }

    if (opts.projectId && (typeof opts.projectId !== 'string')) {
      reject(TypeError('options.projectId must be of type string'));
    }

    if (opts.orderBy && !['created'].includes(ops.orderBy)) {
      reject(RangeError(`options.orderBy must be 'created', other values may follow in later release`));
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
    let colRef = admin.firestore().collection('leads-' + opts.projectId);

    // unless set the default order direction is oldest to newest leads;
    // var orderBy = (opts.orderBy) ? opts.orderBy : 'created';
    // var orderDirection = (opts.orderDirection) ? opts.orderDirection : 'asc';
    // let query = colRef.orderBy(orderBy, orderDirection);

    // limit is an optional parameter
    // if (opts.limit) {
    //   query = query.limit(opts.limit);
    // }

    // if (opts.startAfter) {
    //   query = query.startAfter(opts.startAfter);
    // }

    query.get()
      .then(querySnapshot => {
        let [s, ns] = process.hrtime(ts);
        let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
        console.log(`service.getLeads took ${ms}ms to complete.`);
        resolve(querySnapshot);
      })
      .catch(err => {
        console.error('Error getting leads', err);
        reject(err);
      });
  });
};

Service.prototype.addLead = function addLead(projectId, lead) {
  var ts = process.hrtime();
  let db = admin.firestore();

  let projectRef = db.collection('projects').doc(projectId);
  let leadsCollection = db.collection(`leads-${projectId}`);
  //let newKey = admin.firestore().collection('test').doc().id;

  return db.runTransaction(t => {
    return t.get(projectRef)
      .then(docSnap => {
        let newLeadsCount = docSnap.data().leadsCount + 1;
        let leadDocRef = leadsCollection.doc();

        t.update(projectRef, {
          leadsCount: newLeadsCount
        });

        t.set(leadDocRef, Object.assign({
          _leadNumber: newLeadsCount
        }, lead));

        return {
          leadsCount: newLeadsCount,
          leadDocRef
        };
      });
  })
  .then(result => {
    console.log('Transaction success');
    let [s, ns] = process.hrtime(ts);
    let ms = Number((s * 1000.0) + (ns / 1000000.0)).toFixed(0);
    console.log(`service.addLead took ${ms}ms to complete.`);
    return Promise.resolve(result);
  }).catch(err => {
    console.log('Transaction failure:', err);
    return Promise.reject(err);
  });
};

module.exports = Service;
