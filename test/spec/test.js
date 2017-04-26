/* global describe, it */
'use strict';

var chai = require('chai');
var Scalpel = require('./../../');
var assert = chai.assert;

/**
 * Scalpel mocha test spec - https://mochajs.org/
 * @param {Object} Scalpel - Scalpel unit tests
 */
describe('Scalpel', function () {
	it('should be a function', function () {
		assert.equal(typeof Scalpel, 'function');
	});
});
