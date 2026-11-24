( function () {
	'use strict';

	/* global MutationObserver */
	function suppressVlibras() {
		if ( ! document.body.classList.contains( 'has-portal-video-libras' ) ) {
			return;
		}

		function disableWidgets( widgets ) {
			widgets.forEach( function ( widget ) {
				widget.classList.remove( 'enabled' );
				widget.setAttribute( 'aria-hidden', 'true' );
			} );
			return widgets.length > 0;
		}

		if ( disableWidgets( document.querySelectorAll( 'div[vw]' ) ) ) {
			return;
		}

		const observer = new MutationObserver( function ( mutations ) {
			let found = false;
			mutations.forEach( function ( mutation ) {
				mutation.addedNodes.forEach( function ( node ) {
					if ( node.nodeType !== 1 ) {
						return;
					}
					if ( node.matches( 'div[vw]' ) ) {
						found = disableWidgets( [ node ] ) || found;
					}
					found =
						disableWidgets( node.querySelectorAll( 'div[vw]' ) ) ||
						found;
				} );
			} );
			if ( found ) {
				observer.disconnect();
				window.clearTimeout( timeout );
			}
		} );
		observer.observe( document.body, { childList: true, subtree: true } );
		const timeout = window.setTimeout( function () {
			observer.disconnect();
		}, 10000 );
	}

	function initPlayer() {
		suppressVlibras();
		const root = document.querySelector( '.portal-libras-player' );
		if ( ! root ) {
			return;
		}

		const toggle = root.querySelector( '.portal-libras-player__toggle' );
		const panel = root.querySelector( '.portal-libras-player__panel' );
		const header = root.querySelector( '.portal-libras-player__header' );
		const resizeHandle = root.querySelector(
			'.portal-libras-player__resize'
		);
		const closeButton = root.querySelector(
			'.portal-libras-player__close'
		);
		const videoContainer = root.querySelector(
			'.portal-libras-player__video'
		);
		const videoTemplate = root.querySelector(
			'.portal-libras-player__template'
		);
		const iframeSources = new WeakMap();
		const storageKey = 'portal-libras-player-geometry';
		const margin = 8;
		let interaction = null;
		let positioned = false;
		let videoInitialized = false;
		let animationFrame = null;
		let pendingMovement = null;

		function clamp( value, min, max ) {
			return Math.min( Math.max( value, min ), Math.max( min, max ) );
		}

		function setWidth( width ) {
			const available = Math.max( 0, window.innerWidth - 2 * margin );
			panel.style.width =
				clamp(
					width,
					Math.min( 240, available ),
					Math.min( 640, available )
				) + 'px';
		}

		function setPosition( left, top ) {
			const rect = panel.getBoundingClientRect();
			panel.style.left =
				clamp( left, margin, window.innerWidth - margin - rect.width ) +
				'px';
			panel.style.top =
				clamp(
					top,
					margin,
					window.innerHeight - margin - rect.height
				) + 'px';
		}

		function saveGeometry() {
			const rect = panel.getBoundingClientRect();
			try {
				window.sessionStorage.setItem(
					storageKey,
					JSON.stringify( {
						left: rect.left,
						top: rect.top,
						width: rect.width,
					} )
				);
			} catch ( error ) {
				window.console.warn(
					'Não foi possível salvar a posição do vídeo em LIBRAS.',
					error
				);
			}
		}

		function positionPanel() {
			const rect = panel.getBoundingClientRect();
			let geometry = null;
			if ( ! positioned ) {
				try {
					const stored = window.sessionStorage.getItem( storageKey );
					if ( stored ) {
						geometry = JSON.parse( stored );
					}
				} catch ( error ) {
					window.console.warn(
						'Não foi possível carregar a posição do vídeo em LIBRAS.',
						error
					);
				}
			}
			if (
				! geometry ||
				! Number.isFinite( geometry.left ) ||
				! Number.isFinite( geometry.top ) ||
				! Number.isFinite( geometry.width ) ||
				geometry.width <= 0
			) {
				geometry = {
					left: rect.left,
					top: rect.top,
					width: rect.width,
				};
			}
			panel.style.position = 'fixed';
			panel.style.right = 'auto';
			panel.style.bottom = 'auto';
			panel.style.transform = 'none';
			setWidth( geometry.width );
			setPosition( geometry.left, geometry.top );
			positioned = true;
		}

		function resizeFrom( left, right, bottom ) {
			setWidth( right - left );
			const rect = panel.getBoundingClientRect();
			setPosition( right - rect.width, bottom - rect.height );
		}

		function endInteraction() {
			if ( ! interaction ) {
				return;
			}
			if ( animationFrame !== null ) {
				window.cancelAnimationFrame( animationFrame );
				applyMovement();
			}
			const active = interaction;
			interaction = null;
			panel.classList.remove( 'is-interacting' );
			document.body.classList.remove(
				'portal-libras-player-interacting'
			);
			if ( active.handle.hasPointerCapture( active.pointerId ) ) {
				active.handle.releasePointerCapture( active.pointerId );
			}
			saveGeometry();
		}

		function applyMovement() {
			animationFrame = null;
			const movement = pendingMovement;
			pendingMovement = null;
			if ( interaction.mode === 'drag' ) {
				setPosition(
					interaction.left + movement.dx,
					interaction.top + movement.dy
				);
			} else {
				resizeFrom(
					interaction.left + movement.dx,
					interaction.right,
					interaction.bottom
				);
			}
		}

		function startInteraction( event, mode, handle ) {
			if ( interaction || ! event.isPrimary || event.button !== 0 ) {
				return;
			}
			event.preventDefault();
			const rect = panel.getBoundingClientRect();
			interaction = {
				mode,
				handle,
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				left: rect.left,
				top: rect.top,
				right: rect.right,
				bottom: rect.bottom,
			};
			handle.setPointerCapture( event.pointerId );
			panel.classList.add( 'is-interacting' );
			document.body.classList.add( 'portal-libras-player-interacting' );
		}

		header.addEventListener( 'pointerdown', function ( event ) {
			if ( event.target.closest( 'button' ) ) {
				return;
			}
			startInteraction( event, 'drag', header );
		} );
		resizeHandle.addEventListener( 'pointerdown', function ( event ) {
			event.stopPropagation();
			startInteraction( event, 'resize', resizeHandle );
		} );
		[ header, resizeHandle ].forEach( function ( handle ) {
			handle.addEventListener( 'pointermove', function ( event ) {
				if (
					! interaction ||
					event.pointerId !== interaction.pointerId
				) {
					return;
				}
				pendingMovement = {
					dx: event.clientX - interaction.x,
					dy: event.clientY - interaction.y,
				};
				if ( animationFrame === null ) {
					animationFrame =
						window.requestAnimationFrame( applyMovement );
				}
			} );
			[ 'pointerup', 'pointercancel', 'lostpointercapture' ].forEach(
				function ( type ) {
					handle.addEventListener( type, function ( event ) {
						if (
							interaction &&
							event.pointerId === interaction.pointerId
						) {
							endInteraction();
						}
					} );
				}
			);
		} );
		header.addEventListener( 'keydown', function ( event ) {
			if ( event.target !== header ) {
				return;
			}
			const offsets = {
				ArrowLeft: [ -16, 0 ],
				ArrowRight: [ 16, 0 ],
				ArrowUp: [ 0, -16 ],
				ArrowDown: [ 0, 16 ],
			};
			if ( offsets[ event.key ] ) {
				event.preventDefault();
				const rect = panel.getBoundingClientRect();
				setPosition(
					rect.left + offsets[ event.key ][ 0 ],
					rect.top + offsets[ event.key ][ 1 ]
				);
				saveGeometry();
			}
		} );
		resizeHandle.addEventListener( 'keydown', function ( event ) {
			if ( event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' ) {
				return;
			}
			event.preventDefault();
			const rect = panel.getBoundingClientRect();
			resizeFrom(
				rect.left + ( event.key === 'ArrowLeft' ? -16 : 16 ),
				rect.right,
				rect.bottom
			);
			saveGeometry();
		} );
		window.addEventListener( 'resize', function () {
			if ( ! panel.hidden ) {
				endInteraction();
				positionPanel();
			}
		} );

		function initializeVideo() {
			if ( videoInitialized ) {
				return;
			}
			videoInitialized = true;
			videoTemplate.content
				.querySelectorAll( 'video' )
				.forEach( function ( video ) {
					function updateAspectRatio() {
						if ( video.videoWidth && video.videoHeight ) {
							videoContainer.style.aspectRatio =
								video.videoWidth + ' / ' + video.videoHeight;
							if ( ! panel.hidden ) {
								positionPanel();
							}
						}
					}

					video.addEventListener(
						'loadedmetadata',
						updateAspectRatio
					);
					updateAspectRatio();
				} );
			videoContainer.appendChild( videoTemplate.content );
			videoTemplate.remove();
		}

		function rememberIframeSources() {
			videoContainer
				.querySelectorAll( 'iframe' )
				.forEach( function ( iframe ) {
					if ( ! iframeSources.has( iframe ) ) {
						iframeSources.set(
							iframe,
							iframe.getAttribute( 'src' ) || ''
						);
					}
				} );
		}

		function restoreIframeSources() {
			rememberIframeSources();
			videoContainer
				.querySelectorAll( 'iframe' )
				.forEach( function ( iframe ) {
					const source = iframeSources.get( iframe );
					if (
						source &&
						iframe.getAttribute( 'src' ) === 'about:blank'
					) {
						iframe.setAttribute( 'src', source );
					}
				} );
		}

		function pauseVideos() {
			videoContainer
				.querySelectorAll( 'video' )
				.forEach( function ( video ) {
					video.pause();
				} );

			videoContainer
				.querySelectorAll( 'iframe' )
				.forEach( function ( iframe ) {
					const source =
						iframeSources.get( iframe ) ||
						iframe.getAttribute( 'src' ) ||
						'';
					let origin;
					try {
						origin = new URL( source, window.location.href ).origin;
					} catch ( error ) {
						origin = '*';
					}

					if (
						/youtube(-nocookie)?\.com|youtu\.be/i.test( source )
					) {
						iframe.contentWindow.postMessage(
							JSON.stringify( {
								event: 'command',
								func: 'pauseVideo',
								args: '',
							} ),
							origin
						);
					} else if ( /vimeo\.com/i.test( source ) ) {
						iframe.contentWindow.postMessage(
							JSON.stringify( { method: 'pause' } ),
							origin
						);
					}

					window.setTimeout( function () {
						if ( panel.hidden ) {
							iframe.setAttribute( 'src', 'about:blank' );
						}
					}, 150 );
				} );
		}

		function openPanel() {
			initializeVideo();
			restoreIframeSources();
			panel.hidden = false;
			positionPanel();
			toggle.setAttribute( 'aria-expanded', 'true' );
			closeButton.focus();
		}

		function closePanel() {
			if ( panel.hidden ) {
				return;
			}

			endInteraction();
			panel.hidden = true;
			toggle.setAttribute( 'aria-expanded', 'false' );
			pauseVideos();
			toggle.focus();
		}

		toggle.addEventListener( 'click', function () {
			if ( panel.hidden ) {
				openPanel();
			} else {
				closePanel();
			}
		} );

		closeButton.addEventListener( 'click', closePanel );

		document.addEventListener( 'keydown', function ( event ) {
			if ( event.key === 'Escape' && ! panel.hidden ) {
				closePanel();
			}
		} );

		rememberIframeSources();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initPlayer, {
			once: true,
		} );
	} else {
		initPlayer();
	}
} )();
