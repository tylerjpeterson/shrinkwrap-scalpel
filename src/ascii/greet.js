'use strict';

var chalk = require('chalk');
var version = require('./../../package.json').version;

module.exports = [
	'',
	chalk.black.dim('     shrinkwrap'),
	chalk.bold('     _______ _______ _______         _____  _______  '),
	chalk.bold('     |______ |       |_____| |      |_____] |______ | '),
	chalk.bold('     ______| |_____  |     | |_____ |       |______ |_____'),
	'',
	chalk.black.dim('                                                    v' + version),
	'', ''].join('\n');
