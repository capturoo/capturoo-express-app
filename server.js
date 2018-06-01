'use strict';
const ExpressApp = require('./lib/app');
const config = require('./config');
let app = ExpressApp(config);

app.listen(3000, function() {
  console.log(`App version ${process.env.npm_package_version} started on http://localhost:3000`);
});
