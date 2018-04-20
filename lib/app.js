'use strict';

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.type('text');
  res.send(req.headers['user-agent']);
});

app.get('/leads', function(req, res) {
  res.send('Hello, world 3!');
});

module.exports = app;
