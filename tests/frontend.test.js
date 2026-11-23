const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
	path.join(__dirname, '../assets/js/frontend.js'),
	'utf8'
);

function createPage(readyState, dimensions = {}) {
	const listeners = {};
	const toggle = {
		listeners: {},
		attributes: {},
		addEventListener(type, callback) {
			this.listeners[type] = callback;
		},
		setAttribute(name, value) {
			this.attributes[name] = value;
		},
		focus() {
			document.activeElement = this;
		},
	};
	const closeButton = {
		listeners: {},
		addEventListener(type, callback) {
			this.listeners[type] = callback;
		},
		focus() {
			document.activeElement = this;
		},
	};
	const panel = { hidden: true };
	let pauseCount = 0;
	const video = {
		videoWidth: dimensions.width || 0,
		videoHeight: dimensions.height || 0,
		listeners: {},
		addEventListener(type, callback) {
			this.listeners[type] = callback;
		},
		pause: () => pauseCount++,
	};
	const container = {
		style: {},
		querySelectorAll(selector) {
			return selector === 'video' ? [video] : [];
		},
	};
	const elements = {
		'.portal-libras-player__toggle': toggle,
		'.portal-libras-player__panel': panel,
		'.portal-libras-player__close': closeButton,
		'.portal-libras-player__video': container,
	};
	const root = { querySelector: (selector) => elements[selector] };
	const document = {
		readyState,
		activeElement: null,
		querySelector: () => root,
		addEventListener(type, callback) {
			listeners[type] = callback;
		},
	};

	return {
		document,
		listeners,
		toggle,
		closeButton,
		panel,
		video,
		container,
		getPauseCount: () => pauseCount,
	};
}

test('adapts the player to native video metadata', () => {
	const page = createPage('complete');
	vm.runInNewContext(script, { document: page.document });

	assert.equal(page.container.style.aspectRatio, undefined);
	page.video.videoWidth = 1080;
	page.video.videoHeight = 1920;
	page.video.listeners.loadedmetadata();
	assert.equal(page.container.style.aspectRatio, '1080 / 1920');

	page.video.videoWidth = 0;
	page.video.listeners.loadedmetadata();
	assert.equal(page.container.style.aspectRatio, '1080 / 1920');

	page.video.videoWidth = 720;
	page.video.videoHeight = 720;
	page.video.listeners.loadedmetadata();
	assert.equal(page.container.style.aspectRatio, '720 / 720');
});

test('uses native video metadata already loaded before initialization', () => {
	const page = createPage('complete', { width: 1920, height: 1080 });
	vm.runInNewContext(script, { document: page.document });
	assert.equal(page.container.style.aspectRatio, '1920 / 1080');
});

for (const readyState of ['loading', 'complete']) {
	test(`initializes the player when document state is ${readyState}`, () => {
		const page = createPage(readyState);
		let rootAvailable = readyState !== 'loading';
		const querySelector = page.document.querySelector;
		page.document.querySelector = (selector) =>
			rootAvailable ? querySelector(selector) : null;

		vm.runInNewContext(script, { document: page.document });

		if (!rootAvailable) {
			assert.equal(page.toggle.listeners.click, undefined);
			rootAvailable = true;
			page.listeners.DOMContentLoaded();
		}

		page.toggle.listeners.click();
		assert.equal(page.panel.hidden, false);
		assert.equal(page.toggle.attributes['aria-expanded'], 'true');
		assert.equal(page.document.activeElement, page.closeButton);

		page.listeners.keydown({ key: 'Escape' });
		assert.equal(page.panel.hidden, true);
		assert.equal(page.toggle.attributes['aria-expanded'], 'false');
		assert.equal(page.document.activeElement, page.toggle);
		assert.equal(page.getPauseCount(), 1);
	});
}
