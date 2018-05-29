'use strict';
const ExpressApp = require('./lib/app');
const config = require('./config');

let app = ExpressApp(config);

app.listen(3000, function() {
  console.log('Express app started on http://localhost:3000');
});
