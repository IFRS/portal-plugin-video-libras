(function () {
	'use strict';

	function initPlayer() {
		var root = document.querySelector('.portal-libras-player');
		if (!root) {
			return;
		}

		var toggle = root.querySelector('.portal-libras-player__toggle');
		var panel = root.querySelector('.portal-libras-player__panel');
		var header = root.querySelector('.portal-libras-player__header');
		var resizeHandle = root.querySelector('.portal-libras-player__resize');
		var closeButton = root.querySelector('.portal-libras-player__close');
		var videoContainer = root.querySelector('.portal-libras-player__video');
		var iframeSources = new WeakMap();
		var storageKey = 'portal-libras-player-geometry';
		var margin = 8;
		var interaction = null;
		var positioned = false;

		function clamp(value, min, max) {
			return Math.min(Math.max(value, min), Math.max(min, max));
		}

		function setWidth(width) {
			var available = Math.max(0, window.innerWidth - 2 * margin);
			panel.style.width = clamp(width, Math.min(240, available), Math.min(640, available)) + 'px';
		}

		function setPosition(left, top) {
			var rect = panel.getBoundingClientRect();
			panel.style.left = clamp(left, margin, window.innerWidth - margin - rect.width) + 'px';
			panel.style.top = clamp(top, margin, window.innerHeight - margin - rect.height) + 'px';
		}

		function saveGeometry() {
			var rect = panel.getBoundingClientRect();
			try {
				window.sessionStorage.setItem(storageKey, JSON.stringify({
					left: rect.left,
					top: rect.top,
					width: rect.width,
				}));
			} catch (error) {
				console.warn('Não foi possível salvar a posição do vídeo em LIBRAS.', error);
			}
		}

		function positionPanel() {
			var rect = panel.getBoundingClientRect();
			var geometry = null;
			if (!positioned) {
				try {
					var stored = window.sessionStorage.getItem(storageKey);
					if (stored) {
						geometry = JSON.parse(stored);
					}
				} catch (error) {
					console.warn('Não foi possível carregar a posição do vídeo em LIBRAS.', error);
				}
			}
			if (!geometry || !Number.isFinite(geometry.left) || !Number.isFinite(geometry.top) ||
				!Number.isFinite(geometry.width) || geometry.width <= 0) {
				geometry = { left: rect.left, top: rect.top, width: rect.width };
			}
			panel.style.position = 'fixed';
			panel.style.right = 'auto';
			panel.style.bottom = 'auto';
			setWidth(geometry.width);
			setPosition(geometry.left, geometry.top);
			positioned = true;
		}

		function resizeFrom(left, right, bottom) {
			setWidth(right - left);
			var rect = panel.getBoundingClientRect();
			setPosition(right - rect.width, bottom - rect.height);
		}

		function endInteraction() {
			if (!interaction) {
				return;
			}
			var active = interaction;
			interaction = null;
			panel.classList.remove('is-interacting');
			document.body.classList.remove('portal-libras-player-interacting');
			if (active.handle.hasPointerCapture(active.pointerId)) {
				active.handle.releasePointerCapture(active.pointerId);
			}
			saveGeometry();
		}

		function startInteraction(event, mode, handle) {
			if (interaction || !event.isPrimary || event.button !== 0) {
				return;
			}
			event.preventDefault();
			var rect = panel.getBoundingClientRect();
			interaction = {
				mode: mode,
				handle: handle,
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				left: rect.left,
				top: rect.top,
				right: rect.right,
				bottom: rect.bottom,
			};
			handle.setPointerCapture(event.pointerId);
			panel.classList.add('is-interacting');
			document.body.classList.add('portal-libras-player-interacting');
		}

		header.addEventListener('pointerdown', function (event) {
			if (event.target.closest('button')) {
				return;
			}
			startInteraction(event, 'drag', header);
		});
		resizeHandle.addEventListener('pointerdown', function (event) {
			event.stopPropagation();
			startInteraction(event, 'resize', resizeHandle);
		});
		[header, resizeHandle].forEach(function (handle) {
			handle.addEventListener('pointermove', function (event) {
				if (!interaction || event.pointerId !== interaction.pointerId) {
					return;
				}
				var dx = event.clientX - interaction.x;
				var dy = event.clientY - interaction.y;
				if (interaction.mode === 'drag') {
					setPosition(interaction.left + dx, interaction.top + dy);
				} else {
					resizeFrom(interaction.left + dx, interaction.right, interaction.bottom);
				}
			});
			['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
				handle.addEventListener(type, function (event) {
					if (interaction && event.pointerId === interaction.pointerId) {
						endInteraction();
					}
				});
			});
		});
		header.addEventListener('keydown', function (event) {
			if (event.target !== header) {
				return;
			}
			var offsets = {
				ArrowLeft: [-16, 0],
				ArrowRight: [16, 0],
				ArrowUp: [0, -16],
				ArrowDown: [0, 16],
			};
			if (offsets[event.key]) {
				event.preventDefault();
				var rect = panel.getBoundingClientRect();
				setPosition(rect.left + offsets[event.key][0], rect.top + offsets[event.key][1]);
				saveGeometry();
			}
		});
		resizeHandle.addEventListener('keydown', function (event) {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
				return;
			}
			event.preventDefault();
			var rect = panel.getBoundingClientRect();
			resizeFrom(rect.left + (event.key === 'ArrowLeft' ? -16 : 16), rect.right, rect.bottom);
			saveGeometry();
		});
		window.addEventListener('resize', function () {
			if (!panel.hidden) {
				endInteraction();
				positionPanel();
			}
		});

		videoContainer.querySelectorAll('video').forEach(function (video) {
			function updateAspectRatio() {
				if (video.videoWidth && video.videoHeight) {
					videoContainer.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
					if (!panel.hidden) {
						positionPanel();
					}
				}
			}

			video.addEventListener('loadedmetadata', updateAspectRatio);
			updateAspectRatio();
		});

		function rememberIframeSources() {
			videoContainer.querySelectorAll('iframe').forEach(function (iframe) {
				if (!iframeSources.has(iframe)) {
					iframeSources.set(iframe, iframe.getAttribute('src') || '');
				}
			});
		}

		function restoreIframeSources() {
			rememberIframeSources();
			videoContainer.querySelectorAll('iframe').forEach(function (iframe) {
				var source = iframeSources.get(iframe);
				if (source && iframe.getAttribute('src') === 'about:blank') {
					iframe.setAttribute('src', source);
				}
			});
		}

		function pauseVideos() {
			videoContainer.querySelectorAll('video').forEach(function (video) {
				video.pause();
			});

			videoContainer.querySelectorAll('iframe').forEach(function (iframe) {
				var source = iframeSources.get(iframe) || iframe.getAttribute('src') || '';
				var origin;
				try {
					origin = new URL(source, window.location.href).origin;
				} catch (error) {
					origin = '*';
				}

				if (/youtube(-nocookie)?\.com|youtu\.be/i.test(source)) {
					iframe.contentWindow.postMessage(
						JSON.stringify({
							event: 'command',
							func: 'pauseVideo',
							args: '',
						}),
						origin
					);
				} else if (/vimeo\.com/i.test(source)) {
					iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), origin);
				}

				window.setTimeout(function () {
					if (panel.hidden) {
						iframe.setAttribute('src', 'about:blank');
					}
				}, 150);
			});
		}

		function openPanel() {
			restoreIframeSources();
			panel.hidden = false;
			positionPanel();
			toggle.setAttribute('aria-expanded', 'true');
			closeButton.focus();
		}

		function closePanel() {
			if (panel.hidden) {
				return;
			}

			endInteraction();
			panel.hidden = true;
			toggle.setAttribute('aria-expanded', 'false');
			pauseVideos();
			toggle.focus();
		}

		toggle.addEventListener('click', function () {
			if (panel.hidden) {
				openPanel();
			} else {
				closePanel();
			}
		});

		closeButton.addEventListener('click', closePanel);

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape' && !panel.hidden) {
				closePanel();
			}
		});

		rememberIframeSources();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initPlayer, { once: true });
	} else {
		initPlayer();
	}
})();
