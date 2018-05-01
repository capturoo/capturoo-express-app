'use strict';
const ExpressApp = require('./lib/app');
const credentials = require('./credentials');

let app = ExpressApp(credentials);

app.listen(3000, function() {
  console.log('Express app started on http://localhost:3000');
});
