import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { Notice, TextControl } from '@wordpress/components';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { createElement, useEffect, useState } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';
import { __ } from '@wordpress/i18n';

const META_KEY = 'portal_libras_video_url';

function isValidVideoUrl( value ) {
	if ( ! value ) {
		return true;
	}

	try {
		const parsed = new URL( value );
		return [ 'http:', 'https:' ].includes( parsed.protocol );
	} catch {
		return false;
	}
}

function LibrasVideoPanel() {
	const postType = useSelect(
		( select ) => select( 'core/editor' ).getCurrentPostType(),
		[]
	);
	const [ meta, setMeta ] = useEntityProp( 'postType', postType, 'meta' );
	const savedValue = meta?.[ META_KEY ] || '';
	const [ value, setValue ] = useState( savedValue );
	const [ hasError, setHasError ] = useState( false );

	useEffect( () => {
		setValue( savedValue );
		setHasError( false );
	}, [ savedValue ] );

	function updateValue( nextValue ) {
		setValue( nextValue );
		setHasError( ! isValidVideoUrl( nextValue ) );

		if ( ! isValidVideoUrl( nextValue ) ) {
			return;
		}

		const nextMeta = { ...meta };
		if ( nextValue ) {
			nextMeta[ META_KEY ] = nextValue;
		} else {
			nextMeta[ META_KEY ] = '';
		}
		setMeta( nextMeta );
	}

	return createElement(
		PluginDocumentSettingPanel,
		{
			name: 'portal-libras-video-panel',
			title: __( 'Vídeo em LIBRAS', 'portal-video-libras' ),
			className: 'portal-libras-video-panel',
		},
		hasError &&
			createElement(
				Notice,
				{ status: 'error', isDismissible: false },
				__(
					'Informe uma URL HTTP ou HTTPS válida.',
					'portal-video-libras'
				)
			),
		createElement( TextControl, {
			label: __( 'URL do vídeo em LIBRAS', 'portal-video-libras' ),
			type: 'url',
			value,
			placeholder: 'https://',
			onChange: updateValue,
			help: __(
				'Deixe vazio para remover o vídeo.',
				'portal-video-libras'
			),
		} )
	);
}

registerPlugin( 'portal-libras-video', {
	render: LibrasVideoPanel,
} );
