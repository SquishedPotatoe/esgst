/**
 * @typedef {Object} Environment
 * @property {boolean} development
 * @property {boolean} production
 * @property {boolean} test
 * @property {boolean} temporary
 * @property {boolean} withWatch
 * @property {boolean} analyze
 * @property {string} v
 */

const calfinated = require('calfinated')();
const fs = require('fs');
const jpm = require('jpm/lib/xpi');
const JSZip = require('jszip');
const path = require('path');
const webpack = require('webpack');

const BASE_PATH = process.cwd();

// @ts-ignore
const configJson = require(path.resolve(BASE_PATH, 'config.json'));
// @ts-ignore
const packageJson = require(path.resolve(BASE_PATH, 'package.json'));

const loaders = {
	css: {
		loader: 'css-loader',
	},
	style: {
		loader: 'style-loader',
		options: {
			injectType: 'singletonStyleTag',
			insert: 'html',
		},
	},
};

const plugins = {
	banner: webpack.BannerPlugin,
	bundleAnalyzer: require('webpack-bundle-analyzer').BundleAnalyzerPlugin,
	circularDependency: require('circular-dependency-plugin'),
	clean: require('clean-webpack-plugin').CleanWebpackPlugin,
	progressBar: require('progress-bar-webpack-plugin'),
	provide: webpack.ProvidePlugin,

	runAfterBuild: function (callback) {
		this.apply = (compiler) => {
			compiler.hooks.afterEmit.tap('RunAfterBuild', callback);
		};
	},
};

/**
 * @param {Environment} env
 * @param {string} browserName
 */
function getWebExtensionManifest(env, browserName) {
	const manifest = {
		manifest_version: 2,
		name: packageJson.title,
		version: packageJson.version,
		description: packageJson.description,
		icons: {
			64: 'icon.png',
		},
		author: packageJson.author,
		background: {
			scripts: ['lib/browser-polyfill.js', 'eventPage.js'],
		},
		content_scripts: [
			{
				matches: ['*://*.steamgifts.com/*', '*://*.steamtrades.com/*'],
				js: ['lib/browser-polyfill.js', 'esgst.js'],
				run_at: 'document_start',
			},
		],
		permissions: [
			'storage',
			'unlimitedStorage',
			'*://*.steamgifts.com/*',
			'*://*.steamtrades.com/*',
		],
		optional_permissions: [
			'cookies',
			'webRequest',
			'webRequestBlocking',
			'<all_urls>',
			'*://*.api.dropboxapi.com/*',
			'*://*.api.imgur.com/*',
			'*://*.api.steampowered.com/*',
			'*://*.content.dropboxapi.com/*',
			'*://*.files.1drv.com/*',
			'*://*.github.com/*',
			'*://*.googleapis.com/*',
			'*://*.graph.microsoft.com/*',
			'*://*.isthereanydeal.com/*',
			'*://*.esgst.rafaelgomes.xyz/*',
			'*://*.raw.githubusercontent.com/*',
			'*://*.script.google.com/*',
			'*://*.script.googleusercontent.com/*',
			'*://*.steam-tracker.com/*',
			'*://*.steamcommunity.com/*',
			'*://*.store.steampowered.com/*',
			'*://*.userstyles.org/*',
		],
		short_name: 'ESGST',
		web_accessible_resources: ['icon.png', 'permissions.html'],
	};

	switch (browserName) {
		case 'chrome':
			manifest.background.persistent = true;

			if (!env.temporary) {
				manifest.key = configJson.chrome.extensionKey;
			}

			break;
		case 'firefox':
			if (!env.temporary) {
				manifest.browser_specific_settings = {
					gecko: {
						id: configJson.firefox.extensionId,
					},
				};
			}

			break;
		default:
			break;
	}

	if (env.development) {
		manifest.content_security_policy = "script-src 'self' 'unsafe-eval'; object-src 'self';";
		manifest.version_name = packageJson.betaVersion;
	}

	return manifest;
}

/**
 * @param {Environment} env
 * @param {string} browserName
 */
function getLegacyExtensionManifest(env, browserName) {
	const manifest = {
		name: browserName,
		version: packageJson.version,
		description: packageJson.description,
		author: packageJson.author,
		id: 'ESGST@potatoe.edition',
		keywords: ['jetpack'],
		license: 'MIT',
		main: 'index.js',
		title: packageJson.title,
	};

	switch (browserName) {
		case 'palemoon':
			manifest.engines = {
				firefox: '>=52.0 <=52.*',
				'{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}': '>=27.1.0b1 <=28.*',
			};

			break;
		default:
			break;
	}

	if (env.development) {
		manifest.version_name = packageJson.betaVersion;
	}

	return manifest;
}

/**
 * @param {Environment} env
 * @param {string} browserName
 */
function packageWebExtension(env, browserName) {
	return new Promise((resolve, reject) => {
		const extensionPath = path.resolve(BASE_PATH, 'build', browserName);
		const libPath = path.resolve(extensionPath, 'lib');
		const manifestPath = path.resolve(extensionPath, 'manifest.json');

		// @ts-ignore
		const manifestJson = JSON.parse(fs.readFileSync(manifestPath));

		manifestJson.version = packageJson.version;

		if (env.development) {
			manifestJson.version_name = packageJson.betaVersion;
		}

		const manifestStr = JSON.stringify(manifestJson, null, 2);

		fs.writeFileSync(manifestPath, manifestStr);

		const zip = new JSZip();

		zip.file('manifest.json', manifestStr);
		zip
			.folder('lib')
			.file('browser-polyfill.js', fs.readFileSync(path.resolve(libPath, 'browser-polyfill.js')));
		zip.file('eventPage.js', fs.readFileSync(path.resolve(extensionPath, 'eventPage.js')));
		zip.file('esgst.js', fs.readFileSync(path.resolve(extensionPath, 'esgst.js')));
		zip.file('icon.png', fs.readFileSync(path.resolve(extensionPath, 'icon.png')));
		zip.file('permissions.html', fs.readFileSync(path.resolve(extensionPath, 'permissions.html')));
		zip.file('permissions.js', fs.readFileSync(path.resolve(extensionPath, 'permissions.js')));

		zip
			.generateNodeStream({
				compression: 'DEFLATE',
				compressionOptions: {
					level: 9,
				},
				streamFiles: true,
				type: 'nodebuffer',
			})
			.pipe(fs.createWriteStream(path.resolve(BASE_PATH, 'dist', `${browserName}.zip`)))
			.on('finish', () => resolve())
			.on('error', (error) => reject(error));
	});
}

/**
 * @param {Environment} env
 * @param {string} browserName
 */
async function packageLegacyExtension(env, browserName) {
	const extensionPath = path.resolve(BASE_PATH, 'build', browserName);
	const manifestPath = path.resolve(extensionPath, 'package.json');

	// @ts-ignore
	const manifestJson = JSON.parse(fs.readFileSync(manifestPath));

	manifestJson.version = packageJson.version;

	if (env.development) {
		manifestJson.version_name = packageJson.betaVersion;
	}

	const manifestStr = JSON.stringify(manifestJson, null, 2);

	fs.writeFileSync(manifestPath, manifestStr);

	await jpm(manifestJson, {
		addonDir: extensionPath,
		xpiPath: path.resolve(BASE_PATH, 'dist'),
	});
}

/**
 * @param {Environment} env
 */
async function runFinalSteps(env, name) {
	if (!fs.existsSync('./dist')) {
		fs.mkdirSync('./dist');
	}

	if (name === 'userscript') {
		fs.copyFileSync('./build/userscript/esgst.user.js', './dist/userscript.user.js');
		fs.writeFileSync(
			'./dist/userscript.meta.js',
			`// ==UserScript==\n// @version ${packageJson.version}\n// ==/UserScript==`
		);
		return;
	}

	if (!fs.existsSync('./build/chrome/lib')) {
		fs.mkdirSync('./build/chrome/lib');
	}

	if (!fs.existsSync('./build/firefox/lib')) {
		fs.mkdirSync('./build/firefox/lib');
	}

	const filesToCopy = [
		{ from: './src/assets/images/icon.png', to: './build/chrome/icon.png' },
		{ from: './src/html/permissions.html', to: './build/chrome/permissions.html' },
		{ from: './src/assets/images/icon.png', to: './build/firefox/icon.png' },
		{ from: './src/html/permissions.html', to: './build/firefox/permissions.html' },
		{ from: './src/assets/images/icon.png', to: './build/palemoon/icon.png' },
		{ from: './src/assets/images/icon-16.png', to: './build/palemoon/data/icon-16.png' },
		{ from: './src/assets/images/icon-32.png', to: './build/palemoon/data/icon-32.png' },
		{ from: './src/assets/images/icon-64.png', to: './build/palemoon/data/icon-64.png' },
	];

	for (const fileToCopy of filesToCopy) {
		fs.copyFileSync(fileToCopy.from, fileToCopy.to);
	}

	let polyfillFile = fs.readFileSync(
		'./node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
		'utf8'
	);

	polyfillFile = polyfillFile.replace('getBrowserInfo:{minArgs:0,maxArgs:0},', '');

	const filesToCreate = [
		{
			data: polyfillFile,
			path: './build/chrome/lib/browser-polyfill.js',
		},
		{
			data: JSON.stringify(getWebExtensionManifest(env, 'chrome'), null, 2),
			path: './build/chrome/manifest.json',
		},
		{
			data: polyfillFile,
			path: './build/firefox/lib/browser-polyfill.js',
		},
		{
			data: JSON.stringify(getWebExtensionManifest(env, 'firefox'), null, 2),
			path: './build/firefox/manifest.json',
		},
		{
			data: JSON.stringify(getLegacyExtensionManifest(env, 'palemoon'), null, 2),
			path: './build/palemoon/package.json',
		},
	];

	for (const fileToCreate of filesToCreate) {
		fs.writeFileSync(fileToCreate.path, fileToCreate.data);
	}

	try {
		await Promise.all([
			packageWebExtension(env, 'chrome'),
			packageWebExtension(env, 'firefox'),
			packageLegacyExtension(env, 'palemoon'),
		]);
	} catch (error) {
		console.log(error);
	}
}

/**
 * @param {Environment} env
 */
function getWebpackConfig(env, name) {
	let mode;

	if (env.production) {
		mode = 'production';
	} else if (env.development || env.test) {
		mode = 'development';
	} else {
		mode = 'none';
	}

	const config = {
		devtool: env.production || env.test ? false : 'source-map',
		name,
		mode,
		module: {
			rules: [
				{
					test: /\.html$/,
					loader: 'html-loader',
				},
				{
					loaders: [loaders.style, loaders.css],
					test: /\.css$/,
				},
				{
					exclude: /node_modules/,
					test: /\.(t|j)sx?$/,
					use: {
						loader: 'babel-loader',
					},
				},
			],
		},
		plugins: [
			new plugins.circularDependency({
				cwd: process.cwd(),
				exclude: /node_modules/,
				failOnError: true,
			}),
			// @ts-ignore
			new plugins.progressBar(),
		],
		resolve: {
			extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
		},
		watch: env.development && env.withWatch,
		watchOptions: {
			aggregateTimeout: 1000,
			ignored: /node_modules/,
			poll: 1000,
		},
	};
	if (env.test) {
		return config;
	}
	let cleanOnceBeforeBuildPatterns;
	if (name === 'webextension') {
		config.entry = {
			'./chrome/eventPage': ['./src/entry/eventPage_index.js'],
			'./chrome/esgst': ['./src/entry/index.js'],
			'./chrome/permissions': ['./src/entry/permissions_index.js'],
			'./firefox/eventPage': ['./src/entry/eventPage_index.js'],
			'./firefox/esgst': ['./src/entry/index.js'],
			'./firefox/permissions': ['./src/entry/permissions_index.js'],
			'./palemoon/index': ['./src/entry/eventPage_sdk_index.js'],
			'./palemoon/data/esgst': ['./src/entry/sdk_index.js'],
		};
		cleanOnceBeforeBuildPatterns = [
			path.join(process.cwd(), './build/chrome/*'),
			path.join(process.cwd(), './build/firefox/*'),
			path.join(process.cwd(), './build/palemoon/*'),
			path.join(process.cwd(), './dist/*.zip'),
			path.join(process.cwd(), './dist/*.xpi'),
		];
		if (env.analyze) {
			config.plugins.push(new plugins.bundleAnalyzer());
		}
	} else {
		config.entry = { './userscript/esgst.user': ['./src/entry/gm_index.js'] };
		config.optimization = { minimize: false };
		cleanOnceBeforeBuildPatterns = [
			path.join(process.cwd(), './build/userscript/*'),
			path.join(process.cwd(), './dist/*.meta.js'),
			path.join(process.cwd(), `./dist/*.user.js`),
		];
	}
	config.output = {
		filename: '[name].js',
		path: path.resolve(BASE_PATH, 'build'),
	};
	config.plugins.push(
		new plugins.banner({
			banner: fs.readFileSync('./src/entry/eventPage_sdk_banner.js', 'utf8'),
			entryOnly: true,
			raw: true,
			test: /index\.js$/,
		}),
		// @ts-ignore
		new plugins.banner({
			banner: () => {
				const bannerFilePath = './src/entry/monkey_banner.js';

				if (!fs.existsSync(bannerFilePath)) {
					return '';
				}

				return calfinated.process(fs.readFileSync(bannerFilePath, 'utf8'), {
					package: packageJson,
				});
			},
			entryOnly: true,
			raw: true,
			test: /user\.js$/,
		}),
		new plugins.provide({
			$: 'jquery',
			'window.$': 'jquery',
			jQuery: 'jquery',
			'window.jQuery': 'jquery',
		}),
		new plugins.clean({ cleanOnceBeforeBuildPatterns }),
		new plugins.runAfterBuild(() => runFinalSteps(env, name))
	);
	return config;
}

const getWebpackExtensionConfig = (env) => getWebpackConfig(env, 'webextension');
const getWebpackUserscriptConfig = (env) => getWebpackConfig(env, 'userscript');

module.exports = [getWebpackExtensionConfig, getWebpackUserscriptConfig];
