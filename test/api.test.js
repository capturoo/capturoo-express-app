'use strict';
const supertest = require('supertest');
const app = require('../lib/app');

describe('API Integration tests', () => {
  it('returns your User Agent', function(done) {
    supertest(app)
      .get('/')
      .set('User-Agent', 'my cool browser')
      .set('Accept', 'text/plain')
      .expect('Content-Type', /text\/html/)
      .expect(200)
      .end(done);
  });

  it('test another GET', function(done) {
    supertest(app)
      .get('/')
      .set('User-Agent', 'my cool browser')
      .set('Accept', 'text/plain')
      .expect(function(res) {
        console.log(res.text);
        if (res.text !== 'my cool browser') {
          throw Error('Response does not contain User Agent');
        }
      })
      .end(done);
  });
});
