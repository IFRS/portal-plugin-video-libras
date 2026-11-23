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
	function element() {
		const classes = new Set();
		return {
			listeners: {},
			classList: {
				add: (name) => classes.add(name),
				remove: (name) => classes.delete(name),
				contains: (name) => classes.has(name),
			},
			addEventListener(type, callback) {
				this.listeners[type] = callback;
			},
			setPointerCapture(id) {
				this.pointerId = id;
			},
			hasPointerCapture(id) {
				return this.pointerId === id;
			},
			releasePointerCapture() {
				this.pointerId = null;
			},
		};
	}
	const header = element();
	const resizeHandle = element();
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
	const panel = Object.assign(element(), {
		hidden: true,
		style: {},
		getBoundingClientRect() {
			const width = parseFloat(this.style.width) || 384;
			const height = Math.min(40 + width * 9 / 16, window.innerHeight * 0.8, window.innerHeight - 16);
			const left = parseFloat(this.style.left) || (this.style.left ? 0 : 592);
			const top = parseFloat(this.style.top) || (this.style.top ? 0 : 320);
			return { left, top, width, height, right: left + width, bottom: top + height };
		},
	});
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
		'.portal-libras-player__header': header,
		'.portal-libras-player__resize': resizeHandle,
		'.portal-libras-player__close': closeButton,
		'.portal-libras-player__video': container,
	};
	const root = { querySelector: (selector) => elements[selector] };
	const document = {
		readyState,
		body: element(),
		activeElement: null,
		querySelector: () => root,
		addEventListener(type, callback) {
			listeners[type] = callback;
		},
	};
	const storage = new Map();
	const window = {
		innerWidth: 1000,
		innerHeight: 700,
		listeners: {},
		addEventListener(type, callback) {
			this.listeners[type] = callback;
		},
		sessionStorage: {
			getItem: (key) => storage.get(key) || null,
			setItem: (key, value) => storage.set(key, value),
		},
	};

	return {
		document,
		window,
		storage,
		listeners,
		toggle,
		header,
		resizeHandle,
		closeButton,
		panel,
		video,
		container,
		getPauseCount: () => pauseCount,
	};
}

function initialize(page) {
	vm.runInNewContext(script, { document: page.document, window: page.window, console });
}

function pointer(overrides = {}) {
	return Object.assign({
		isPrimary: true,
		button: 0,
		pointerId: 1,
		clientX: 0,
		clientY: 0,
		target: { closest: () => null },
		preventDefault() {},
		stopPropagation() {},
	}, overrides);
}

test('adapts the player to native video metadata', () => {
	const page = createPage('complete');
	initialize(page);

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
	initialize(page);
	assert.equal(page.container.style.aspectRatio, '1920 / 1080');
});

for (const readyState of ['loading', 'complete']) {
	test(`initializes the player when document state is ${readyState}`, () => {
		const page = createPage(readyState);
		let rootAvailable = readyState !== 'loading';
		const querySelector = page.document.querySelector;
		page.document.querySelector = (selector) =>
			rootAvailable ? querySelector(selector) : null;

		initialize(page);

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

test('drag clamps to viewport, cleans up on cancellation and restores geometry', () => {
	const page = createPage('complete');
	initialize(page);
	page.toggle.listeners.click();
	page.header.listeners.pointerdown(pointer());
	assert.equal(page.panel.classList.contains('is-interacting'), true);
	assert.equal(page.document.body.classList.contains('portal-libras-player-interacting'), true);
	page.header.listeners.pointermove(pointer({ clientX: -2000, clientY: -2000 }));
	assert.equal(page.panel.style.left, '8px');
	assert.equal(page.panel.style.top, '8px');
	page.header.listeners.pointercancel(pointer());
	assert.equal(page.panel.classList.contains('is-interacting'), false);
	assert.equal(page.document.body.classList.contains('portal-libras-player-interacting'), false);
	page.closeButton.listeners.click();
	assert.equal(page.getPauseCount(), 1);
	page.toggle.listeners.click();
	assert.equal(page.panel.style.left, '8px');

	const nextPage = createPage('complete');
	nextPage.storage.set('portal-libras-player-geometry', page.storage.get('portal-libras-player-geometry'));
	nextPage.window.innerWidth = 300;
	nextPage.window.innerHeight = 250;
	initialize(nextPage);
	nextPage.toggle.listeners.click();
	assert.equal(nextPage.panel.style.width, '284px');
	assert.equal(nextPage.panel.style.left, '8px');
	assert.equal(nextPage.panel.style.top, '8px');
});

test('resize and keyboard movement respect limits, including viewport changes', () => {
	const page = createPage('complete');
	initialize(page);
	page.toggle.listeners.click();
	page.resizeHandle.listeners.pointerdown(pointer());
	page.resizeHandle.listeners.pointermove(pointer({ clientX: -1000 }));
	assert.equal(page.panel.style.width, '640px');
	page.resizeHandle.listeners.pointerup(pointer());
	page.resizeHandle.listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
	assert.equal(page.panel.style.width, '624px');
	page.header.listeners.keydown({ key: 'ArrowLeft', target: page.header, preventDefault() {} });
	assert.equal(page.panel.style.left, '336px');
	page.window.innerWidth = 350;
	page.window.innerHeight = 220;
	page.window.listeners.resize();
	assert.equal(page.panel.style.width, '334px');
	assert.equal(page.panel.style.left, '8px');
	assert.ok(page.panel.getBoundingClientRect().bottom <= 212);
});

test('close button does not initiate drag and still pauses the video', () => {
	const page = createPage('complete');
	initialize(page);
	page.toggle.listeners.click();
	page.header.listeners.pointerdown(pointer({ target: { closest: () => page.closeButton } }));
	assert.equal(page.panel.classList.contains('is-interacting'), false);
	page.closeButton.listeners.click();
	assert.equal(page.panel.hidden, true);
	assert.equal(page.getPauseCount(), 1);
});

test('invalid saved geometry is ignored and closing during drag releases interaction', () => {
	const page = createPage('complete');
	page.storage.set('portal-libras-player-geometry', '{"left":-500,"top":0,"width":"invalid"}');
	initialize(page);
	page.toggle.listeners.click();
	assert.equal(page.panel.style.left, '592px');
	page.header.listeners.pointerdown(pointer());
	page.header.listeners.pointerup(pointer({ pointerId: 2 }));
	assert.equal(page.panel.classList.contains('is-interacting'), true);
	page.closeButton.listeners.click();
	assert.equal(page.panel.classList.contains('is-interacting'), false);
	assert.equal(page.document.body.classList.contains('portal-libras-player-interacting'), false);
	assert.equal(page.header.pointerId, null);
	assert.equal(page.getPauseCount(), 1);
});

function createVlibrasPage(hasVideo, widgets = []) {
	let observer;
	let timer;
	const document = {
		readyState: 'complete',
		body: { classList: { contains: () => hasVideo } },
		querySelector: () => null,
		querySelectorAll: () => widgets,
	};
	const window = {
		setTimeout(callback, delay) {
			timer = { callback, delay, cleared: false };
			return timer;
		},
		clearTimeout(id) {
			id.cleared = true;
		},
	};
	class MutationObserver {
		constructor(callback) {
			observer = this;
			this.callback = callback;
			this.disconnected = false;
		}
		observe(target, options) {
			this.target = target;
			this.options = options;
		}
		disconnect() {
			this.disconnected = true;
		}
	}
	vm.runInNewContext(script, { document, window, MutationObserver, console });
	return { widgets, getObserver: () => observer, getTimer: () => timer };
}

function vlibrasWidget() {
	const classes = new Set(['enabled']);
	return {
		nodeType: 1,
		attributes: {},
		matches: (selector) => selector === 'div[vw]',
		querySelectorAll: () => [],
		classList: {
			contains: (name) => classes.has(name),
			remove: (name) => classes.delete(name),
		},
		setAttribute(name, value) {
			this.attributes[name] = value;
		},
	};
}

test('suppresses an existing VLibras widget only on pages with video', () => {
	const widget = vlibrasWidget();
	const page = createVlibrasPage(true, [widget]);
	assert.equal(widget.classList.contains('enabled'), false);
	assert.equal(widget.attributes['aria-hidden'], 'true');
	assert.equal(page.getObserver(), undefined);

	const untouched = vlibrasWidget();
	const otherPage = createVlibrasPage(false, [untouched]);
	assert.equal(untouched.classList.contains('enabled'), true);
	assert.equal(untouched.attributes['aria-hidden'], undefined);
	assert.equal(otherPage.getObserver(), undefined);
});

test('suppresses dynamically injected VLibras widgets and stops observing', () => {
	const page = createVlibrasPage(true);
	const observer = page.getObserver();
	assert.equal(observer.options.childList, true);
	assert.equal(observer.options.subtree, true);
	assert.equal(page.getTimer().delay, 10000);
	observer.callback([{ addedNodes: [{ nodeType: 3 }] }]);
	assert.equal(observer.disconnected, false);
	const first = vlibrasWidget();
	const second = vlibrasWidget();
	const container = {
		nodeType: 1,
		matches: () => false,
		querySelectorAll: () => [second],
	};
	observer.callback([{ addedNodes: [first, container] }]);
	assert.equal(first.classList.contains('enabled'), false);
	assert.equal(second.attributes['aria-hidden'], 'true');
	assert.equal(observer.disconnected, true);
	assert.equal(page.getTimer().cleared, true);
});

test('stops observing after the timeout if no widget is injected', () => {
	const page = createVlibrasPage(true);
	page.getTimer().callback();
	assert.equal(page.getObserver().disconnected, true);
});
