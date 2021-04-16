const path = require('path'),
	fsUtil = require('../util/fs-util'),
	fsPromise = require('../util/fs-promise'),
	runYarn = require('../util/run-yarn');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	const npmOptions = (options && options['npm-options']) ? options['npm-options'].split(' ') : [],
		runPostPackageScript = function () {
			const script = options['post-package-script'];
			if (script) {
				return runYarn(packageDir, ['run', script].concat(npmOptions), logger, options && options.quiet);
			}
		},
		fixEntryPermissions = function (path) {
			return fsPromise.statAsync(path)
			.then(stats => {
				const requiredMode = stats.isDirectory() ? 0o755 : 0o644;
				return (stats.mode & 0o777) | requiredMode;
			})
			.then(mode => fsPromise.chmodAsync(path, mode));
		},
		fixFilePermissions = function () {
			return Promise.all(
				fsUtil.recursiveList(packageDir)
				.map(component => fixEntryPermissions(path.join(packageDir, component)))
			);
		},
		cleanUpDependencies = function () {
			if (options['optional-dependencies'] === false) {
				logger.logApiCall('removing optional dependencies');
				fsUtil.rmDir(path.join(packageDir, 'node_modules'));
				return runYarn(packageDir, ['install', '--silent', '--production', '--ignore-optional'].concat(npmOptions), logger, options && options.quiet);
			}
		};
	return Promise.resolve()
	.then(() => fsUtil.silentRemove(path.join(packageDir, 'yarn.lock')))
	.then(cleanUpDependencies)
	.then(runPostPackageScript)
	.then(() => fsUtil.silentRemove(path.join(packageDir, '.yarnrc')))
	.then(fixFilePermissions)
	.then(() => packageDir);
};
