'use strict';
const chai = require('chai');
const assert = chai.assert;

const NotEmpty = require('../../../lib/validators/NotEmpty');

describe('NotEmpty Validator', () => {
  it('returns your User Agent', function(done) {
    const notEmptyValidator = new NotEmpty();
    notEmptyValidator.setLanguage('th');


  }
});
