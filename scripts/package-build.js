const AdmZip = require('adm-zip');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const buildDirectory = path.join(root, 'build');
const pluginName = 'portal-plugin-video-libras';
const pluginDirectory = path.join(buildDirectory, pluginName);
const packagedFiles = [
	'LICENSE',
	'README.md',
	'portal-plugin-video-libras.php',
];

fs.mkdirSync(pluginDirectory, { recursive: true });

for (const file of packagedFiles) {
	fs.copyFileSync(path.join(root, file), path.join(pluginDirectory, file));
}

for (const directory of ['includes', path.join('assets', 'img')]) {
	fs.cpSync(path.join(root, directory), path.join(pluginDirectory, directory), {
		recursive: true,
	});
}

const compiledAssetsDirectory = path.join(pluginDirectory, 'assets', 'build');
fs.mkdirSync(compiledAssetsDirectory, { recursive: true });

for (const file of [
	'editor.asset.php',
	'editor.js',
	'frontend.css',
	'frontend.js',
	'settings.css',
	'settings.js',
]) {
	fs.copyFileSync(
		path.join(root, 'assets', 'build', file),
		path.join(compiledAssetsDirectory, file)
	);
}

const zip = new AdmZip();
zip.addLocalFolder(pluginDirectory, pluginName);
zip.writeZip(path.join(buildDirectory, `${pluginName}.zip`));
