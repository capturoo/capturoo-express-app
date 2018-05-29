const admin = require('firebase-admin');

function Service(config) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.credentials),
      databaseURL: config.database.url
    });
  }
}

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
            let base62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
        console.log(`service.createProject took ${ms}ms to complete.`);

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
        console.log(`service.getProjects took ${ms}ms to complete.`);
        resolve(snapshot);
      })
      .catch(err => {
        console.error('Error getting documents', err);
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

    console.log('get leads');

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
