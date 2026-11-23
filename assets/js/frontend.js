(function () {
	'use strict';

	function initPlayer() {
		var root = document.querySelector('.portal-libras-player');
		if (!root) {
			return;
		}

		var toggle = root.querySelector('.portal-libras-player__toggle');
		var panel = root.querySelector('.portal-libras-player__panel');
		var closeButton = root.querySelector('.portal-libras-player__close');
		var videoContainer = root.querySelector('.portal-libras-player__video');
		var iframeSources = new WeakMap();

		videoContainer.querySelectorAll('video').forEach(function (video) {
			function updateAspectRatio() {
				if (video.videoWidth && video.videoHeight) {
					videoContainer.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
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
			toggle.setAttribute('aria-expanded', 'true');
			closeButton.focus();
		}

		function closePanel() {
			if (panel.hidden) {
				return;
			}

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
