const path = require('path');
const webpack = require('webpack');
const packageJson = require('./package.json');
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const { zipSync } = require('fflate');

const outputDir = path.resolve(__dirname, 'build');
const zipOutputPath = path.resolve(__dirname, 'dist', 'chrome-mv3.zip');

async function zipBuildFolder() {
    const fileMap = {};

    async function addFilesRecursive(dir, baseDir) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const absPath = path.join(dir, entry.name);
            const relPath = path.relative(baseDir, absPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                await addFilesRecursive(absPath, baseDir);
            } else {
                const content = await fs.promises.readFile(absPath);
                fileMap[relPath] = content;
            }
        }
    }

    await addFilesRecursive(outputDir, outputDir);

    const zippedData = zipSync(fileMap, { level: 9 });

    await fs.promises.mkdir(path.dirname(zipOutputPath), { recursive: true });
    await fs.promises.writeFile(zipOutputPath, zippedData);
    console.log(`✅ ZIP created: ${zipOutputPath}`);
}

// --- Webpack config ---
function getWebExtensionManifest(env) {
	return {
		manifest_version: 3,
		name: packageJson.title,
		version: packageJson.version,
		description: packageJson.description,
		author: packageJson.author,
		icons: { "64": "icon.png" },
		permissions: ['storage', 'unlimitedStorage', 'tabs', 'alarms'],
		host_permissions: [
			'*://*.steamgifts.com/*',
			'*://*.steamtrades.com/*',
		],
		optional_permissions: ["cookies", "notifications"],
		optional_host_permissions: [
			"<all_urls>",
			"*://*.api.dropboxapi.com/*",
			"*://*.api.imgur.com/*",
			"*://*.api.steampowered.com/*",
			"*://*.content.dropboxapi.com/*",
			"*://*.esgst.rafaelgomes.xyz/*",
			"*://*.files.1drv.com/*",
			"*://*.github.com/*",
			"*://*.googleapis.com/*",
			"*://*.graph.microsoft.com/*",
			"*://*.isthereanydeal.com/*",
			"*://*.raw.githubusercontent.com/*",
			"*://*.script.google.com/*",
			"*://*.script.googleusercontent.com/*",
			"*://*.sgtools.info/*",
			"*://*.steam-tracker.com/*",
			"*://*.steamcommunity.com/*",
			"*://*.store.steampowered.com/*",
		],
		content_scripts: [
			{
				matches: ['*://*.steamgifts.com/*', '*://*.steamtrades.com/*'],
				js: ['esgst.js'],
				css: ['styles.css'],
				run_at: 'document_start',
			},
		],
		options_ui: { page: 'permissions.html', open_in_tab: true },
		web_accessible_resources: [
			{ resources: ['icon.png', 'permissions.html', 'lib/script-datepicker.js', 'lib/script-holiday.js', 'lib/script-accurate-timestamp.js', 'lib/script-custom-giveaway-calendar.js'], matches: ['<all_urls>'] },
		],
		background: { service_worker: 'eventPage.js', type: 'module' },
	};
}

module.exports = (env = {}) => {
	const isProduction = !!env.production;
	const outputDir = path.resolve(__dirname, 'build');

	return {
		mode: isProduction ? 'production' : 'development',
		devtool: isProduction ? false : 'inline-source-map',
		entry: {
			esgst: ['./src/entry/index.js'],
			eventPage: ['./src/eventPage.js'],
			permissions: ['./src/entry/permissions_index.js'],
		},
		output: {
			path: outputDir,
			filename: '[name].js',
		},
		module: {
			rules: [
				{
					test: /\.[jt]sx?$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							presets: [
								['@babel/preset-env', { targets: { chrome: '140' }, bugfixes: true, useBuiltIns: false }],
								['@babel/preset-react', { runtime: 'classic', pragma: 'DOM.element', pragmaFrag: 'DOM.fragment' }],
								'@babel/preset-typescript',
							],
						},
					},
				},
				{
					test: /\.css$/i,
					use: [
						MiniCssExtractPlugin.loader,
						{
							loader: 'css-loader',
							options: {
								sourceMap: false, // disable CSS source maps
							},
						},
					],
				},
			],
		},
		plugins: [
			new WebpackExtensionManifestPlugin({
				config: getWebExtensionManifest(env),
			}),
			new MiniCssExtractPlugin({ filename: 'styles.css' }),
			new webpack.ProvidePlugin({
				$: 'jquery',
				jQuery: 'jquery',
				'window.jQuery': 'jquery',
				'window.$': 'jquery',
			}),
			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
			}),
			new ProgressBarPlugin({ format: '  build [:bar] :percent (:elapsed seconds)', clear: false, width: 40 }),

			new CopyWebpackPlugin({
				patterns: [
					{ from: 'src/lib/script-datepicker.js', to: 'lib/script-datepicker.js' },
					{ from: 'src/lib/script-holiday.js', to: 'lib/script-holiday.js' },
					{ from: 'src/lib/script-accurate-timestamp.js', to: 'lib/script-accurate-timestamp.js' },
					{ from: 'src/lib/script-custom-giveaway-calendar.js', to: 'lib/script-custom-giveaway-calendar.js' },
					{ from: 'src/assets/images/icon.png', to: 'icon.png' },
					{ from: 'src/html/permissions.html', to: 'permissions.html' },
				],
			}),
			{
				apply: (compiler) => {
					compiler.hooks.done.tapPromise('generatingZip', zipBuildFolder);
				},
			},
		],
		resolve: {
			extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
			alias: { jquery: path.resolve(__dirname, 'node_modules/jquery') },
		},
		optimization: isProduction
			? {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						extractComments: false,
						terserOptions: { format: { comments: false, beautify: false } },
					}),
				],
			}
			: {},
	};
};
