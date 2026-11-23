const config = require('@wordpress/scripts/config/webpack.config');

const cssRule = config.module.rules.find(
	(rule) => rule.test instanceof RegExp && rule.test.test('.css')
);
const cssLoader = cssRule.use.find(
	(loader) =>
		typeof loader === 'object' &&
		loader.loader === require.resolve('css-loader')
);

cssLoader.options.url = false;

module.exports = config;
