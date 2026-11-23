(function () {
	'use strict';

	var color = document.getElementById('portal-libras-color');
	var position = document.getElementById('portal-libras-position');
	var offset = document.getElementById('portal-libras-offset');
	var width = document.getElementById('portal-libras-width');
	var label = document.getElementById('portal-libras-label');
	var widget = document.querySelector('.portal-libras-preview__widget');
	var previewLabel = document.querySelector('.portal-libras-preview__label');

	function foreground(hex) {
		var channels = [1, 3, 5].map(function (index) {
			var value = parseInt(hex.slice(index, index + 2), 16) / 255;
			return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
		});
		var luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
		var dark = Math.pow((17 / 255 + 0.055) / 1.055, 2.4);
		var whiteRatio = 1.05 / (luminance + 0.05);
		var darkRatio = (luminance + 0.05) / (dark + 0.05);
		if (Math.max(whiteRatio, darkRatio) < 4.5) {
			return '#000000';
		}
		return whiteRatio >= darkRatio ? '#ffffff' : '#111111';
	}

	function update() {
		widget.style.setProperty('--preview-bg', color.value);
		widget.style.setProperty('--preview-fg', foreground(color.value));
		widget.style.setProperty('--preview-offset', Math.min(30, Math.max(0, Number(offset.value) || 0)) + 'px');
		widget.style.setProperty('--preview-width', { compact: '120px', standard: '145px', large: '180px' }[width.value]);
		widget.className = 'portal-libras-preview__widget is-pos-' + position.value;
		previewLabel.textContent = label.value;
	}

	document.querySelectorAll('.portal-libras-color').forEach(function (button) {
		button.addEventListener('click', function () {
			var hex = button.dataset.color;
			if (hex.length === 4) {
				hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
			}
			color.value = hex;
			update();
		});
	});
	[color, position, offset, width, label].forEach(function (input) {
		input.addEventListener('input', update);
		input.addEventListener('change', update);
	});
	update();
})();
