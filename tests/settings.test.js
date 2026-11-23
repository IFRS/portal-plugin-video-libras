const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../assets/js/settings.js'), 'utf8');

test('preview tracks position, label, colors and theme swatches', () => {
	function input(value) {
		return {
			value,
			listeners: {},
			addEventListener(type, callback) { this.listeners[type] = callback; },
		};
	}
	const inputs = {
		'portal-libras-color': input('#005a9c'),
		'portal-libras-position': input('bottom'),
		'portal-libras-offset': input('24'),
		'portal-libras-width': input('standard'),
		'portal-libras-label': input('Tradução em LIBRAS'),
	};
	const widget = { style: { values: {}, setProperty(key, value) { this.values[key] = value; } } };
	const label = {};
	const swatch = { dataset: { color: '#abc' }, addEventListener(type, callback) { this.click = callback; } };
	const document = {
		getElementById: (id) => inputs[id],
		querySelector: (selector) => selector === '.portal-libras-preview__widget' ? widget : label,
		querySelectorAll: () => [swatch],
	};
	vm.runInNewContext(script, { document });
	assert.equal(widget.style.values['--preview-fg'], '#ffffff');
	inputs['portal-libras-color'].value = '#0078e1';
	inputs['portal-libras-position'].value = 'middle';
	inputs['portal-libras-label'].value = 'Teste';
	inputs['portal-libras-color'].listeners.input();
	assert.equal(widget.style.values['--preview-fg'], '#000000');
	assert.equal(widget.className, 'portal-libras-preview__widget is-pos-middle');
	assert.equal(label.textContent, 'Teste');
	swatch.click();
	assert.equal(inputs['portal-libras-color'].value, '#aabbcc');
	assert.equal(widget.style.values['--preview-bg'], '#aabbcc');
});
