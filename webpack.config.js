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
	css: { loader: 'css-loader' },
	style: { loader: 'style-loader', options: { injectType: 'singletonStyleTag', insert: 'html' } },
};

const plugins = {
	banner: webpack.BannerPlugin,
	bundleAnalyzer: require('webpack-bundle-analyzer').BundleAnalyzerPlugin,
	circularDependency: require('circular-dependency-plugin'),
	clean: require('clean-webpack-plugin').CleanWebpackPlugin,
	progressBar: require('progress-bar-webpack-plugin'),
	provide: webpack.ProvidePlugin,
	runAfterBuild(callback) {
		return {
			apply(compiler) {
				compiler.hooks.afterEmit.tapPromise('RunAfterBuild', async () => {
					try {
						await callback();
					} catch (e) {
						console.error('[RunAfterBuild ERROR]', e);
					}
				});
			},
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
		icons: { 64: 'icon.png' },
		author: packageJson.author,
		background: { scripts: ['lib/browser-polyfill.js', 'eventPage.js'] },
		content_scripts: [
			{
				matches: ['*://*.steamgifts.com/*', '*://*.steamtrades.com/*'],
				js: ['lib/browser-polyfill.js', 'esgst.js'],
				run_at: 'document_start',
			},
		],
		permissions: [
			'storage', 'unlimitedStorage', '*://*.steamgifts.com/*', '*://*.steamtrades.com/*'
		],
		optional_permissions: [
			'cookies', 'webRequest', 'webRequestBlocking', '<all_urls>',
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
			'*://*.userstyles.org/*'
		],
		short_name: 'ESGST',
		web_accessible_resources: ['icon.png', 'permissions.html'],
	};

	switch (browserName) {
		case 'chrome':
			manifest.background.persistent = true;
			if (!env.temporary) manifest.key = configJson.chrome.extensionKey;
			break;
		case 'firefox':
			if (!env.temporary) manifest.browser_specific_settings = { gecko: { id: configJson.firefox.extensionId } };
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

	if (browserName === 'palemoon') {
		manifest.engines = {
			firefox: '>=52.0 <=52.*',
			'{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}': '>=27.1.0b1 <=28.*',
		};
	}

	if (env.development) manifest.version_name = packageJson.betaVersion;

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
		const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
		manifestJson.version = packageJson.version;
		if (env.development) manifestJson.version_name = packageJson.betaVersion;
		fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2));

		const zip = new JSZip();
		zip.file('manifest.json', JSON.stringify(manifestJson, null, 2));
		zip.folder('lib').file('browser-polyfill.js', fs.readFileSync(path.resolve(libPath, 'browser-polyfill.js')));
		zip.file('eventPage.js', fs.readFileSync(path.resolve(extensionPath, 'eventPage.js')));
		zip.file('esgst.js', fs.readFileSync(path.resolve(extensionPath, 'esgst.js')));
		zip.file('icon.png', fs.readFileSync(path.resolve(extensionPath, 'icon.png')));
		zip.file('permissions.html', fs.readFileSync(path.resolve(extensionPath, 'permissions.html')));
		zip.file('permissions.js', fs.readFileSync(path.resolve(extensionPath, 'permissions.js')));
		zip.generateNodeStream({ compression: 'DEFLATE', compressionOptions: { level: 9 }, streamFiles: true, type: 'nodebuffer' })
			.pipe(fs.createWriteStream(path.resolve(BASE_PATH, 'dist', `${browserName}.zip`)))
			.on('finish', resolve)
			.on('error', reject);
	});
}

/**
 * @param {Environment} env
 * @param {string} browserName
 */
async function packageLegacyExtension(env, browserName) {
	const extensionPath = path.resolve(BASE_PATH, 'build', browserName);
	const manifestPath = path.resolve(extensionPath, 'package.json');
	const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	manifestJson.version = packageJson.version;
	if (env.development) manifestJson.version_name = packageJson.betaVersion;
	fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2));
	await jpm(manifestJson, { addonDir: extensionPath, xpiPath: path.resolve(BASE_PATH, 'dist') });
}

/**
 * @param {Environment} env
 * @param {string} name
 */
async function runFinalSteps(env, name) {
	if (!fs.existsSync('./dist')) fs.mkdirSync('./dist');
	if (!fs.existsSync('./build/userscript')) fs.mkdirSync('./build/userscript');

	if (name === 'userscript') {
		fs.copyFileSync('./build/userscript/esgst.user.js', './dist/userscript.user.js');
		fs.copyFileSync('./build/userscript/esgst.dev.user.js', './dist/userscript.dev.user.js');
		fs.writeFileSync(
			'./dist/userscript.meta.js',
			`// ==UserScript==\n// @version ${packageJson.version}\n// ==/UserScript==`
		);
		return;
	}

	if (!fs.existsSync('./build/chrome/lib')) fs.mkdirSync('./build/chrome/lib');
	if (!fs.existsSync('./build/firefox/lib')) fs.mkdirSync('./build/firefox/lib');

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
	for (const fileToCopy of filesToCopy) fs.copyFileSync(fileToCopy.from, fileToCopy.to);

	const polyfillFile = fs.readFileSync(
		'./node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
		'utf8'
	);

	const filesToCreate = [
		{ data: polyfillFile, path: './build/chrome/lib/browser-polyfill.js' },
		{ data: JSON.stringify(getWebExtensionManifest(env, 'chrome'), null, 2), path: './build/chrome/manifest.json' },
		{ data: polyfillFile, path: './build/firefox/lib/browser-polyfill.js' },
		{ data: JSON.stringify(getWebExtensionManifest(env, 'firefox'), null, 2), path: './build/firefox/manifest.json' },
		{ data: JSON.stringify(getLegacyExtensionManifest(env, 'palemoon'), null, 2), path: './build/palemoon/package.json' },
	];
	for (const fileToCreate of filesToCreate) fs.writeFileSync(fileToCreate.path, fileToCreate.data);

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
 * @param {string} name
 */
function getWebpackConfig(env, name) {
	const mode = env.production ? 'production' : env.development || env.test ? 'development' : 'none';

	const config = {
		devtool: env.production || env.test ? false : 'source-map',
		name,
		mode,
		module: {
			rules: [
				{ test: /\.html$/, loader: 'html-loader' },
				{ test: /\.css$/, use: [loaders.style, loaders.css] },
				{ test: /\.(t|j)sx?$/, exclude: /node_modules/, use: { loader: 'babel-loader' } },
			],
		},
		resolve: { 
			extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
			alias: { jquery: path.resolve(__dirname, 'node_modules/jquery/dist/jquery.js') },
		},
		watch: env.development && env.withWatch,
		watchOptions: { aggregateTimeout: 1000, ignored: /node_modules/, poll: 1000 },
		plugins: [
			new plugins.circularDependency({ cwd: process.cwd(), exclude: /node_modules/, failOnError: true }),
			new plugins.progressBar(),
		],
		output: { filename: '[name].js', path: path.resolve(BASE_PATH, 'build') },
	};

	if (name !== 'webextension') return config;

	if (env.analyzeExtensions) {
		config.plugins.push(new plugins.bundleAnalyzer({ analyzerMode: 'static', reportFilename: 'report-extension.html' }));
	}

	config.entry = {
		'chrome/eventPage': ['./src/entry/eventPage_index.js'],
		'chrome/esgst': ['./src/entry/index.js'],
		'chrome/permissions': ['./src/entry/permissions_index.js'],
		'firefox/eventPage': ['./src/entry/eventPage_index.js'],
		'firefox/esgst': ['./src/entry/index.js'],
		'firefox/permissions': ['./src/entry/permissions_index.js'],
		'palemoon/index': ['./src/entry/eventPage_sdk_index.js'],
		'palemoon/data/esgst': ['./src/entry/sdk_index.js'],
	};

	config.plugins.push(
		new webpack.BannerPlugin({
			banner: fs.readFileSync('./src/entry/eventPage_sdk_banner.js', 'utf8'),
			entryOnly: true,
			raw: true,
			test: /index\.js$/,
		}),
		new plugins.provide({
			$: 'jquery',
			'window.$': 'jquery',
			jQuery: 'jquery',
			'window.jQuery': 'jquery',
		}),
		new plugins.clean({
			cleanOnceBeforeBuildPatterns: [
				path.join(process.cwd(), './build/chrome/*'),
				path.join(process.cwd(), './build/firefox/*'),
				path.join(process.cwd(), './build/palemoon/*'),
				path.join(process.cwd(), './dist/*.zip'),
				path.join(process.cwd(), './dist/*.xpi'),
			],
		}),
		plugins.runAfterBuild(async () => {
			await runFinalSteps(env, name);
		})
	);
	return config;
}

/**
 * @param {Environment} env
 */
function getUserscriptConfigs(env) {
	const baseConfig = {
		entry: { './userscript/esgst.user': ['./src/entry/gm_index.js'] },
		externals: {
			jquery: 'jQuery',
			$: 'jQuery',
			'window.jQuery': 'jQuery',
			'jquery-ui/ui/widgets/progressbar': 'jQuery',
			'jquery-ui/ui/widgets/slider': 'jQuery',
		},
		module: {
			rules: [
				{ test: /\.html$/, loader: 'html-loader' },
				{ test: /\.css$/, use: [loaders.style, loaders.css] },
				{ test: /\.(t|j)sx?$/, exclude: /node_modules/, use: { loader: 'babel-loader' } },
			],
		},
		resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
		output: { path: path.resolve(BASE_PATH, 'build') },
		watch: env.development && env.withWatch,
		watchOptions: { aggregateTimeout: 1000, ignored: /node_modules/, poll: 1000 },
		plugins: [
			new plugins.circularDependency({ cwd: process.cwd(), exclude: /node_modules/, failOnError: true }),
			new plugins.progressBar(),
			plugins.runAfterBuild(() => runFinalSteps(env, 'userscript')),
		],
	};

	function userscriptBannerPlugin(filename) {
		return new webpack.BannerPlugin({
			banner: function () {
				const bannerFile = './src/entry/monkey_banner.js';
				if (!fs.existsSync(bannerFile)) return '';
				const userscript = filename.includes('.dev.user.js')
					? 'userscript.dev.user.js'
					: 'userscript.user.js';
				return calfinated.process(fs.readFileSync(bannerFile, 'utf8'), {
					package: packageJson,
					userscript,
					unminified: userscript.includes('.dev.user.js'),
				});
			},
			entryOnly: true,
			raw: true,
			test: /user\.js$/,
		});
	}

	const minified = {
		...baseConfig,
		name: 'userscript-minified',
		mode: 'production',
		devtool: false,
		optimization: { minimize: true },
		output: { ...baseConfig.output, filename: './userscript/esgst.user.js' },
		plugins: [...baseConfig.plugins, userscriptBannerPlugin('./userscript/esgst.user.js')],
	};

	const unminified = {
		...baseConfig,
		name: 'userscript-unminified',
		mode: 'none',
		devtool: false,
		optimization: { minimize: false },
		output: { ...baseConfig.output, filename: './userscript/esgst.dev.user.js' },
		plugins: [...baseConfig.plugins, userscriptBannerPlugin('./userscript/esgst.dev.user.js')],
	};

	if (env.analyzeUserscript) {
		unminified.plugins.push(new plugins.bundleAnalyzer({ analyzerMode: 'static', reportFilename: 'report-userscript.html' }));
	}
	return [minified, unminified];
}

module.exports = (env) => [
	getWebpackConfig(env, 'webextension'),
	...getUserscriptConfigs(env),
];
