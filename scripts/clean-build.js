const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

for (const output of ['build', path.join('assets', 'build')]) {
	fs.rmSync(path.join(root, output), { recursive: true, force: true });
}
