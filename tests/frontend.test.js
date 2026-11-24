const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
	path.join(__dirname, '../assets/js/frontend.js'),
	'utf8'
);

function createPage(readyState, dimensions = {}, iframe = null) {
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
	let injected = false;
	let injectionCount = 0;
	const template = {
		content: {
			querySelectorAll: (selector) => selector === 'video' && !iframe ? [video] : [],
		},
		remove() {},
	};
	const container = {
		style: {},
		appendChild(content) {
			assert.equal(content, template.content);
			injected = true;
			injectionCount++;
		},
		querySelectorAll(selector) {
			if (!injected) return [];
			if (selector === 'video') return iframe ? [] : [video];
			if (selector === 'iframe') return iframe ? [iframe] : [];
			return [];
		},
	};
	const elements = {
		'.portal-libras-player__toggle': toggle,
		'.portal-libras-player__panel': panel,
		'.portal-libras-player__header': header,
		'.portal-libras-player__resize': resizeHandle,
		'.portal-libras-player__close': closeButton,
		'.portal-libras-player__video': container,
		'.portal-libras-player__template': template,
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
	const frames = new Map();
	const timers = [];
	let nextFrame = 0;
	const window = {
		innerWidth: 1000,
		innerHeight: 700,
		listeners: {},
		addEventListener(type, callback) {
			this.listeners[type] = callback;
		},
		requestAnimationFrame(callback) {
			const id = nextFrame++;
			frames.set(id, callback);
			return id;
		},
		cancelAnimationFrame(id) {
			frames.delete(id);
		},
		setTimeout(callback) {
			timers.push(callback);
		},
		location: { href: 'https://example.test/' },
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
		frames,
		timers,
		flushFrame() {
			const callbacks = [...frames.values()];
			frames.clear();
			callbacks.forEach((callback) => callback());
		},
		getInjectionCount: () => injectionCount,
		getPauseCount: () => pauseCount,
	};
}

function initialize(page) {
	vm.runInNewContext(script, { document: page.document, window: page.window, console, URL });
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
	page.toggle.listeners.click();
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

test('uses native video metadata already loaded before first opening', () => {
	const page = createPage('complete', { width: 1920, height: 1080 });
	initialize(page);
	assert.equal(page.container.style.aspectRatio, undefined);
	page.toggle.listeners.click();
	assert.equal(page.container.style.aspectRatio, '1920 / 1080');
});

test('injects video only on first opening and preserves it when reopening', () => {
	const page = createPage('complete');
	initialize(page);
	assert.equal(page.getInjectionCount(), 0);
	assert.equal(page.video.listeners.loadedmetadata, undefined);
	page.toggle.listeners.click();
	assert.equal(page.getInjectionCount(), 1);
	page.closeButton.listeners.click();
	page.toggle.listeners.click();
	assert.equal(page.getInjectionCount(), 1);
	assert.equal(page.getPauseCount(), 1);
});

test('restores iframe source on reopening without reinjecting', () => {
	const messages = [];
	const iframe = {
		src: 'https://www.youtube.com/embed/example',
		getAttribute: () => iframe.src,
		setAttribute: (name, value) => { iframe.src = value; },
		contentWindow: { postMessage: (message, origin) => messages.push({ message, origin }) },
	};
	const page = createPage('complete', {}, iframe);
	initialize(page);
	assert.equal(page.getInjectionCount(), 0);
	page.toggle.listeners.click();
	page.closeButton.listeners.click();
	assert.equal(messages.length, 1);
	assert.equal(JSON.parse(messages[0].message).func, 'pauseVideo');
	assert.equal(messages[0].origin, 'https://www.youtube.com');
	page.timers[0]();
	assert.equal(iframe.src, 'about:blank');
	page.toggle.listeners.click();
	assert.equal(iframe.src, 'https://www.youtube.com/embed/example');
	assert.equal(page.getInjectionCount(), 1);
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
	page.flushFrame();
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
	page.flushFrame();
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

test('coalesces pointer moves and flushes the last move before saving on release', () => {
	const page = createPage('complete');
	initialize(page);
	page.toggle.listeners.click();
	page.header.listeners.pointerdown(pointer());
	page.header.listeners.pointermove(pointer({ clientX: -10, clientY: -10 }));
	page.header.listeners.pointermove(pointer({ clientX: -20, clientY: -30 }));
	assert.equal(page.frames.size, 1);
	assert.equal(page.panel.style.left, '592px');
	page.header.listeners.pointerup(pointer());
	assert.equal(page.frames.size, 0);
	assert.equal(page.panel.style.left, '572px');
	assert.equal(page.panel.style.top, '290px');
	assert.equal(JSON.parse(page.storage.get('portal-libras-player-geometry')).left, 572);
});

test('flushes a pending resize when closing during interaction', () => {
	const page = createPage('complete');
	initialize(page);
	page.toggle.listeners.click();
	page.resizeHandle.listeners.pointerdown(pointer());
	page.resizeHandle.listeners.pointermove(pointer({ clientX: -100 }));
	page.closeButton.listeners.click();
	assert.equal(page.frames.size, 0);
	assert.equal(page.panel.style.width, '484px');
	assert.equal(JSON.parse(page.storage.get('portal-libras-player-geometry')).width, 484);
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

test('initial geometry comes from the configured CSS before clearing the middle-position transform', () => {
	const page = createPage('complete');
	page.panel.getBoundingClientRect = function () {
		const width = parseFloat(this.style.width) || 280;
		const left = this.style.left ? parseFloat(this.style.left) : 640;
		const top = this.style.top ? parseFloat(this.style.top) : 190;
		return { left, top, width, height: 200, right: left + width, bottom: top + 200 };
	};
	initialize(page);
	page.toggle.listeners.click();
	assert.equal(page.panel.style.width, '280px');
	assert.equal(page.panel.style.left, '640px');
	assert.equal(page.panel.style.top, '190px');
	assert.equal(page.panel.style.transform, 'none');
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
