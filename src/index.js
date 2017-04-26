#!/usr/bin/env node
'use strict';

const execSync = require('child_process').execSync;
const exec = require('child_process').exec;
const tmpdir = require('os').tmpdir();
const format = require('util').format;
const path = require('path');

const cloneDeep = require('lodash/cloneDeep');
const merge = require('lodash/merge');
const inquirer = require('inquirer');
const findUp = require('find-up');
const fsj = require('fs-jetpack');
const chalk = require('chalk');

const LANG = require('./lang/en_us.json');
const GREET = require('./ascii/greet');

const ui = new inquirer.ui.BottomBar();

/**
 * Finds closest shrinkwrap and package to set some properties.
 *
 * @class
 * Scalpel
 *
 * @classdesc
 * Allows you to selectively update individual dependencies within an existing shrinkwrap.
 * You therefore avoid picking up unintentional updates from loosely defined dependencies
 * anywhere from within your dependency tree.
 * The majority of the data consumed by this module is retrieved via `npm view ...` commands.
 * Therefore you must be able to run npm via your shell, and the speed with which it executes
 * will be dependent upon the complexity of your tree and your network.
 *
 * @param {Object} options - Instantiation options
 * @param {Boolean} [options.showDiff=false] - Display a universal diff between old shrinkwrap and new upon completion
 */
class Scalpel {
	constructor(options) {
		console.log(GREET);

		this.shrinkWrapPath = findUp.sync('npm-shrinkwrap.json');
		this.packagePath = findUp.sync('package.json');

		if (!this.shrinkWrapPath || !this.packagePath) {
			console.error(chalk.red.bold(LANG.NO_SHRINKWRAP));
			console.error(chalk.red(LANG.NO_SHRINKWRAP_DETAILS));
			process.exit();
		}

		this.options = merge({}, Scalpel.DEFAULTS, options || {});
		this.shrinkWrap = require(this.shrinkWrapPath);
		this.package = require(this.packagePath);
		this.tmpPackage = cloneDeep(this.package);
		this.cwd = process.cwd();

		this.tmpPackage.devDependencies = {};
		this.tmpPackage.dependencies = {};
		this.skippedModules = [];
		this.deps = {};

		this.getDeps();
	}

	/**
	 * Get local references to project dependencies and ask user which ones need to be upgraded / downgraded
	 * @return null
	 */
	getDeps() {
		this.deps.shrunk = this.shrinkWrap.dependencies;
		this.deps.pkgs = Object.keys(this.deps.shrunk);
		this.deps.vers = this.deps.pkgs.map(d => this.mapVersions(d));

		this.askWhichDeps();
	}

	/**
	 * Format dependencies into collection keyed from name and value (version)
	 * @param  {string} dep - Dependency name and version as single @-delimited string
	 * @return {object}
	 */
	mapVersions(dep) {
		const name = format('%s%s%s',
			chalk.bold(dep), '@', this.deps.shrunk[dep].version);

		return {
			name: name,
			short: '\n  ' + dep,
			value: dep
		};
	}

	/**
	 * Create collection of inquirer questions and prompt user for answers
	 * @return null
	 */
	askWhichDeps() {
		const question = {
			name: 'deps',
			type: 'checkbox',
			choices: this.deps.vers,
			message: LANG.WHICH_DEPS
		};

		ui.updateBottomBar('');

		inquirer
			.prompt(question)
			.then(answers => this.getAvailableVersions(answers))
			.catch(err => console.error(err));
	}

	/**
	 * Run `npm view {pkg}` to retrieve all available versions for a given package
	 * @param  {string} pkg - Module to retrieve versions of
	 * @param  {string} prop - Package.json key (module property) to retrieve
	 * @return {array} Collection of versions for the requested package
	 */
	viewPackage(pkg, prop) {
		const command = format('npm view %s %s', pkg, prop);
		const objectIdentifiers = ['[', '{'];

		let result = null;

		return new Promise((resolve, reject) => {
			exec(command, (err, stdout, stderr) => {
				if (err || stderr) {
					reject(err || stderr);
				}

				result = stdout.toString();

				if (objectIdentifiers.indexOf(result.trim().charAt(0)) !== -1) {
					result = JSON.parse(result.replace(/'/g, '"'));
				}

				resolve(result);
			});
		});
	}

	/**
	 * Create inquirer questions about requested models including all available versions, excluding current version
	 * @param  {object} answer - Inquirer answer object containing all of the dependencies to be upgraded
	 * @return null
	 */
	getAvailableVersions(answer) {
		let result = null;
		let current = null;

		const questionTpl = {
			type: 'list',
			message: LANG.WHICH_VERS
		};

		const promises = answer.deps.map(pkg => {
			return new Promise(resolve => {
				this.viewPackage(pkg, 'versions').then(data => {
					current = this.deps.shrunk[pkg].version;
					result = typeof data === 'string' ? [data.trim()] : data;
					result = result.filter(val => current !== val);

					if (result.length < 1) {
						this.skippedModules.push([
							chalk.magenta(format(LANG.SKIPPING, pkg)),
							chalk.magenta.dim(format(LANG.SKIPPING_REASON, current))
						].join(''));
						resolve(null);
					}

					result = merge({}, questionTpl, {
						name: pkg,
						choices: result,
						message: format(questionTpl.message,
							chalk.bold(pkg),
							chalk.reset(format(LANG.CURRENT, current))
						)
					});

					resolve(result);
				});
			});
		});

		Promise.all(promises).then(versionQuestions => {
			versionQuestions = versionQuestions.filter(v => v !== null);

			if (this.skippedModules.length > 0) {
				this.skippedModules.forEach(s => console.log(s));
				this.skippedModules = [];
				console.log('');
			}

			if (versionQuestions.length < 1) {
				ui.clean();

				console.error(chalk.yellow.bold(LANG.NO_VERSIONS));
				console.error(chalk.yellow(LANG.NO_VERSIONS_EXIT));
				process.exit();
			}

			ui.updateBottomBar('');

			inquirer.prompt(versionQuestions)
				.then(dependencies => this.updateShrinkWrap(dependencies))
				.catch(console.error.bind(console));
		})
		.catch(err => console.error(err));
	}

	/**
	 * Clear out the cloned project's package.json dependencies
	 * @return null
	 */
	updateShrinkWrap(deps) {
		if (Object.keys(deps).length < 1) {
			console.error(chalk.yellow.bold('No dependencies selected for modification'));
			console.error(chalk.yellow('Exiting with no change to npm-shrinkwrap.json'));
			process.exit();
		}

		this.tmpPackage.dependencies = deps;

		ui.updateBottomBar(LANG.BUILDING_TMP_FILES);

		this.buildModule();
	}

	/**
	 * Create package.json and install in temp directory, prune the dependencies, shrinkwrap
	 * the temp project and remove the temp dir when npm-shrinkwrap contents are retrieved
	 * @return null
	 */
	buildModule() {
		const pkg = Object.keys(this.tmpPackage.dependencies);
		const dir = path.join(tmpdir, 'scalpel-' + Date.now());
		const wrap = path.join(dir, 'npm-shrinkwrap.json');
		const output = Date.now() + '.patch';

		let wrapDeps = null;
		let backup = null;

		fsj.dir(dir, {empty: true});

		fsj.write(path.join(dir, 'package.json'), this.tmpPackage);

		ui.write('\n');

		process.chdir(dir);

		ui.updateBottomBar(LANG.INSTALLING);
		execSync('npm install --silent');

		ui.updateBottomBar(LANG.PRUNING);
		execSync('npm prune --silent');

		ui.updateBottomBar(LANG.SHRINKING);
		execSync(format('npm shrinkwrap --silent --dev'));

		wrapDeps = fsj.read(wrap, 'json').dependencies;

		pkg.forEach(p => {
			this.shrinkWrap.dependencies[p] = wrapDeps[p];
		});

		process.chdir(this.cwd);

		backup = this.backup(this.shrinkWrapPath);

		fsj.write(this.shrinkWrapPath, this.shrinkWrap);

		fsj.dir(dir, {empty: true});

		ui.updateBottomBar('');

		console.log(chalk.green.bold(LANG.DONE));

		console.log(chalk.green.dim(LANG.BACKUP),
			chalk.reset.green.underline(path.parse(backup).base));

		console.log(chalk.green.dim(LANG.RECAP),
			chalk.reset.green.underline(path.parse(this.shrinkWrapPath).base));

		if (this.options.showDiff) {
			console.log(chalk.green.dim(LANG.DIFF),
				chalk.reset.green.underline(output));

			this.diff(backup, this.shrinkWrapPath, output);
		}

		console.log(chalk.gray(LANG.DIFF_PROMPT));

		console.log(LANG.DIFF_CMD,
			backup.replace(process.cwd() + '/', ''),
			this.shrinkWrapPath.replace(process.cwd() + '/', '')
		);
	}

	/**
	 * Create backup of existing file in advance of overwrite
	 * @param  {string} file - Path to file to backup
	 * @return {string} Path to newly created backup file
	 */
	backup(file) {
		const parts = path.parse(file);

		const backupName = format('%s-%s%s',
			parts.name, Date.now(), parts.ext);

		fsj.rename(file, backupName);

		return path.join(parts.dir, backupName);
	}

	/**
	 * Create a diff between an old version of a file and the newly created version
	 * @param  {string} file1 - Path to file to diff
	 * @param  {string} file2 - Path to file to new diff
	 * @return null
	 */
	diff(file1, file2, output) {
		const diffCmd = format('diff -u %s %s > %s || true',
			file1, file2, output);

		const viewCmd = format('cat "%s" | %s',
			output, process.env.EDITOR);

		exec(diffCmd, () => {
			exec(viewCmd);
		});
	}
}

/**
 * DEFAULTS
 * @type {Object}
 */
Scalpel.DEFAULTS = {
	showDiff: false
};

module.exports = Scalpel;
