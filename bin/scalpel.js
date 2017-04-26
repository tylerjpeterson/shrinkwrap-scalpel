#!/usr/bin/env node
'use strict';

var Scalpel = require('./../dist');

var diff = !(process.argv.slice(2).indexOf('--diff') === -1);

new Scalpel({showDiff: diff});
