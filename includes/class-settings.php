<?php
/**
 * Plugin settings for sites and networks.
 *
 * @package PortalVideoLibras
 */

namespace PortalVideoLibras;

final class Settings {
	const OPTION = 'portal_video_libras_settings';
	const PAGE   = 'portal-video-libras';

	public function register_hooks() {
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_menu', array( $this, 'add_site_page' ) );
		add_action( 'network_admin_menu', array( $this, 'add_network_page' ) );
		add_action( 'network_admin_edit_portal_video_libras', array( $this, 'save_network' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	public static function defaults() {
		return array(
			'position'         => 'bottom',
			'offset'           => 16,
			'color'            => '#005a9c',
			'width'            => 'standard',
			'label'            => __( 'Tradução em LIBRAS', 'portal-video-libras' ),
			'post_types'       => 'all',
			'suppress_vlibras' => true,
		);
	}

	/**
	 * Resolve each key independently, allowing partial saved configurations.
	 */
	public static function get_option( $key ) {
		$defaults = self::defaults();
		if ( ! array_key_exists( $key, $defaults ) ) {
			return null;
		}

		$site    = get_option( self::OPTION, array() );
		$site    = is_array( $site ) ? $site : array();
		$network = is_multisite() ? get_site_option( self::OPTION, array() ) : array();
		$network = is_array( $network ) ? $network : array();

		if ( ( ! is_multisite() || empty( $site['inherit'] ) ) && array_key_exists( $key, $site ) && self::valid_value( $key, $site[ $key ] ) ) {
			return $site[ $key ];
		}
		if ( array_key_exists( $key, $network ) && self::valid_value( $key, $network[ $key ] ) ) {
			return $network[ $key ];
		}
		return $defaults[ $key ];
	}

	private static function valid_value( $key, $value ) {
		switch ( $key ) {
			case 'position':
				return in_array( $value, array( 'bottom', 'middle', 'top' ), true );
			case 'width':
				return in_array( $value, array( 'compact', 'standard', 'large' ), true );
			case 'offset':
				return ( is_int( $value ) || ( is_string( $value ) && ctype_digit( $value ) ) ) && (int) $value >= 0 && (int) $value <= 10000;
			case 'color':
				return is_string( $value ) && (bool) preg_match( '/^#[0-9a-fA-F]{6}$/', $value ) && (bool) sanitize_hex_color( $value );
			case 'label':
				return is_string( $value ) && '' !== trim( $value );
			case 'post_types':
				if ( 'all' === $value ) {
					return true;
				}
				if ( ! is_array( $value ) ) {
					return false;
				}
				foreach ( $value as $type ) {
					if ( ! is_string( $type ) || sanitize_key( $type ) !== $type ) {
						return false;
					}
				}
				return true;
			case 'suppress_vlibras':
				return is_bool( $value ) || 0 === $value || 1 === $value || '0' === $value || '1' === $value;
		}
		return false;
	}

	public static function post_type_enabled( $post_type ) {
		$types = self::get_option( 'post_types' );
		return 'all' === $types || in_array( $post_type, $types, true );
	}

	/**
	 * Select the foreground with the greater WCAG contrast ratio.
	 */
	public static function foreground( $color ) {
		$channels = array();
		foreach ( array( 1, 3, 5 ) as $offset ) {
			$channel    = hexdec( substr( $color, $offset, 2 ) ) / 255;
			$channels[] = $channel <= 0.04045 ? $channel / 12.92 : pow( ( $channel + 0.055 ) / 1.055, 2.4 );
		}
		$luminance = 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
		$dark      = pow( ( 17 / 255 + 0.055 ) / 1.055, 2.4 );
		$white_ratio = 1.05 / ( $luminance + 0.05 );
		$dark_ratio  = ( $luminance + 0.05 ) / ( $dark + 0.05 );
		if ( max( $white_ratio, $dark_ratio ) < 4.5 ) {
			return '#000000';
		}
		return $white_ratio >= $dark_ratio ? '#ffffff' : '#111111';
	}

	public static function icon() {
		return '<span class="portal-libras-icon" aria-hidden="true"></span>';
	}

	public function register_settings() {
		register_setting( 'portal_video_libras', self::OPTION, array( 'sanitize_callback' => array( $this, 'sanitize' ) ) );
		add_settings_section( 'portal_video_libras_main', '', '__return_false', self::PAGE );
		foreach ( array(
			'inherit'          => __( 'Configurações da rede', 'portal-video-libras' ),
			'position'         => __( 'Posição vertical', 'portal-video-libras' ),
			'offset'           => __( 'Distância das bordas (px)', 'portal-video-libras' ),
			'color'            => __( 'Cor do botão e da barra', 'portal-video-libras' ),
			'width'            => __( 'Largura inicial', 'portal-video-libras' ),
			'label'            => __( 'Rótulo de acessibilidade', 'portal-video-libras' ),
			'post_types'       => __( 'Tipos de conteúdo', 'portal-video-libras' ),
			'suppress_vlibras' => __( 'Integração com VLibras', 'portal-video-libras' ),
		) as $key => $title ) {
			if ( 'inherit' === $key && ( ! is_multisite() || is_network_admin() ) ) {
				continue;
			}
			$args = array( 'key' => $key );
			if ( ! in_array( $key, array( 'inherit', 'post_types', 'suppress_vlibras' ), true ) ) {
				$args['label_for'] = 'portal-libras-' . $key;
			}
			add_settings_field( $key, $title, array( $this, 'render_field' ), self::PAGE, 'portal_video_libras_main', $args );
		}
	}

	public function add_site_page() {
		add_options_page( __( 'Vídeo em LIBRAS', 'portal-video-libras' ), __( 'Vídeo em LIBRAS', 'portal-video-libras' ), 'manage_options', self::PAGE, array( $this, 'render_page' ) );
	}

	public function add_network_page() {
		add_submenu_page( 'settings.php', __( 'Vídeo em LIBRAS', 'portal-video-libras' ), __( 'Vídeo em LIBRAS', 'portal-video-libras' ), 'manage_network_options', self::PAGE, array( $this, 'render_page' ) );
	}

	public function enqueue_assets( $hook ) {
		if ( ! isset( $_GET['page'] ) || self::PAGE !== sanitize_key( wp_unslash( $_GET['page'] ) ) || false === strpos( $hook, 'portal-video-libras' ) ) {
			return;
		}
		wp_enqueue_style( 'portal-video-libras-settings', PORTAL_VIDEO_LIBRAS_URL . 'assets/build/settings.css', array(), PORTAL_VIDEO_LIBRAS_VERSION );
		wp_enqueue_script( 'portal-video-libras-settings', PORTAL_VIDEO_LIBRAS_URL . 'assets/build/settings.js', array(), PORTAL_VIDEO_LIBRAS_VERSION, true );
	}

	private function page_values() {
		if ( is_network_admin() ) {
			$stored = get_site_option( self::OPTION, array() );
			$stored = is_array( $stored ) ? $stored : array();
			$values = self::defaults();
			foreach ( $values as $key => $default ) {
				if ( isset( $stored[ $key ] ) && self::valid_value( $key, $stored[ $key ] ) ) {
					$values[ $key ] = $stored[ $key ];
				}
			}
			return $values;
		}
		$values = array();
		foreach ( self::defaults() as $key => $default ) {
			$values[ $key ] = self::get_option( $key );
		}
		$site              = get_option( self::OPTION, array() );
		$values['inherit'] = is_multisite() && ( ! is_array( $site ) || ! array_key_exists( 'inherit', $site ) ? empty( $site ) : ! empty( $site['inherit'] ) );
		if ( $values['inherit'] && is_array( $site ) ) {
			foreach ( self::defaults() as $key => $default ) {
				if ( array_key_exists( $key, $site ) && self::valid_value( $key, $site[ $key ] ) ) {
					$values[ $key ] = $site[ $key ];
				}
			}
		}
		return $values;
	}

	public function sanitize( $input ) {
		$input    = is_array( $input ) ? $input : array();
		$defaults = self::defaults();
		$output   = array();
		foreach ( array( 'position', 'offset', 'color', 'width', 'label' ) as $key ) {
			$value = isset( $input[ $key ] ) && is_scalar( $input[ $key ] ) ? (string) $input[ $key ] : '';
			if ( 'color' === $key ) {
				$value = sanitize_hex_color( $value );
				if ( is_string( $value ) && 4 === strlen( $value ) ) {
					$value = '#' . $value[1] . $value[1] . $value[2] . $value[2] . $value[3] . $value[3];
				}
			} elseif ( 'label' === $key ) {
				$value = sanitize_text_field( $value );
			}
			if ( ! self::valid_value( $key, $value ) ) {
				add_settings_error( self::OPTION, 'invalid_' . $key, sprintf( __( 'Valor inválido para %s; o padrão foi restaurado.', 'portal-video-libras' ), $key ), 'error' );
				$value = $defaults[ $key ];
			}
			$output[ $key ] = 'offset' === $key ? (int) $value : $value;
		}
		$public = get_post_types( array( 'public' => true ), 'names' );
		$types  = isset( $input['post_types'] ) && is_array( $input['post_types'] ) ? $input['post_types'] : array();
		$output['post_types'] = array_values( array_intersect( $public, array_filter( $types, 'is_string' ) ) );
		if ( ( isset( $input['post_types'] ) && ! is_array( $input['post_types'] ) ) || count( $output['post_types'] ) !== count( $types ) ) {
			add_settings_error( self::OPTION, 'invalid_post_types', __( 'Alguns tipos de conteúdo inválidos foram ignorados.', 'portal-video-libras' ), 'error' );
		}
		$output['suppress_vlibras'] = ! empty( $input['suppress_vlibras'] );
		if ( is_multisite() && ! is_network_admin() ) {
			$output['inherit'] = ! empty( $input['inherit'] );
		}
		return $output;
	}

	public function save_network() {
		if ( ! current_user_can( 'manage_network_options' ) ) {
			wp_die( esc_html__( 'Você não tem permissão para alterar estas configurações.', 'portal-video-libras' ) );
		}
		check_admin_referer( 'portal_video_libras_network' );
		$input = isset( $_POST[ self::OPTION ] ) ? wp_unslash( $_POST[ self::OPTION ] ) : array();
		update_site_option( self::OPTION, $this->sanitize( $input ) );
		set_transient( 'portal_libras_settings_errors_' . get_current_user_id(), get_settings_errors( self::OPTION ), MINUTE_IN_SECONDS );
		wp_safe_redirect( add_query_arg( array( 'page' => self::PAGE, 'updated' => 'true' ), network_admin_url( 'settings.php' ) ) );
		exit;
	}

	public function render_page() {
		$network = is_network_admin();
		if ( ! current_user_can( $network ? 'manage_network_options' : 'manage_options' ) ) {
			wp_die( esc_html__( 'Você não tem permissão para acessar esta página.', 'portal-video-libras' ) );
		}
		if ( $network ) {
			$key    = 'portal_libras_settings_errors_' . get_current_user_id();
			$errors = get_transient( $key );
			if ( is_array( $errors ) ) {
				foreach ( $errors as $error ) {
					add_settings_error( $error['setting'], $error['code'], $error['message'], $error['type'] );
				}
				delete_transient( $key );
			}
			if ( isset( $_GET['updated'] ) && ! $errors ) {
				add_settings_error( self::OPTION, 'updated', __( 'Configurações salvas.', 'portal-video-libras' ), 'success' );
			}
		}
		?>
		<div class="wrap portal-libras-settings">
			<h1><?php esc_html_e( 'Vídeo em LIBRAS', 'portal-video-libras' ); ?></h1>
			<?php settings_errors( self::OPTION ); ?>
			<div class="portal-libras-settings__layout">
				<form method="post" action="<?php echo esc_url( $network ? network_admin_url( 'edit.php?action=portal_video_libras' ) : admin_url( 'options.php' ) ); ?>">
					<?php
					if ( $network ) {
						wp_nonce_field( 'portal_video_libras_network' );
					} else {
						settings_fields( 'portal_video_libras' );
					}
					do_settings_sections( self::PAGE );
					submit_button();
					?>
				</form>
				<aside class="portal-libras-preview">
					<h2><?php esc_html_e( 'Pré-visualização', 'portal-video-libras' ); ?></h2>
					<div class="portal-libras-preview__canvas">
						<div class="portal-libras-preview__widget">
							<div class="portal-libras-preview__panel">
								<div class="portal-libras-preview__header"><span class="portal-libras-preview__label"></span><span aria-hidden="true">&times;</span></div>
								<div class="portal-libras-preview__video"></div>
							</div>
							<div class="portal-libras-preview__button"><?php echo self::icon(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Static markup. ?></div>
						</div>
					</div>
				</aside>
			</div>
		</div>
		<?php
	}

	private function palette() {
		$palette = function_exists( 'wp_get_global_settings' ) ? wp_get_global_settings( array( 'color', 'palette' ) ) : array();
		if ( isset( $palette['theme'] ) ) {
			$palette = $palette['theme'];
		} elseif ( isset( $palette['default'] ) || isset( $palette['custom'] ) ) {
			$palette = array();
		}
		if ( empty( $palette ) ) {
			$support = get_theme_support( 'editor-color-palette' );
			$palette = isset( $support[0] ) ? $support[0] : array();
		}
		$colors = array();
		$collect = function ( $items ) use ( &$collect, &$colors ) {
			if ( ! is_array( $items ) ) {
				return;
			}
			foreach ( $items as $item ) {
				if ( is_array( $item ) && isset( $item['color'], $item['name'] ) && is_string( $item['color'] ) ) {
					$color = sanitize_hex_color( $item['color'] );
					if ( $color ) {
						$colors[ $color ] = $item['name'];
					}
				} else {
					$collect( $item );
				}
			}
		};
		$collect( $palette );
		return $colors;
	}

	public function render_field( $args ) {
		$key    = $args['key'];
		$values = $this->page_values();
		$value  = $values[ $key ];
		$name   = self::OPTION . '[' . $key . ']';
		$id     = 'portal-libras-' . $key;
		switch ( $key ) {
			case 'inherit':
				?><label><input id="<?php echo esc_attr( $id ); ?>" type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( $value ); ?>> <?php esc_html_e( 'Herdar configurações padrão da Rede', 'portal-video-libras' ); ?></label>
				<p class="description"><?php esc_html_e( 'Enquanto marcada, o site usa as opções da rede. As opções e a pré-visualização abaixo representam a configuração local, que pode ser salva para uso posterior.', 'portal-video-libras' ); ?></p><?php
				break;
			case 'position':
			case 'width':
				$options = 'position' === $key ? array( 'bottom' => __( 'Inferior', 'portal-video-libras' ), 'middle' => __( 'Meio', 'portal-video-libras' ), 'top' => __( 'Superior', 'portal-video-libras' ) ) : array( 'compact' => __( 'Compacta (280 px)', 'portal-video-libras' ), 'standard' => __( 'Padrão (340 px)', 'portal-video-libras' ), 'large' => __( 'Ampliada (420 px)', 'portal-video-libras' ) );
				?><select id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>"><?php foreach ( $options as $option => $label ) { ?><option value="<?php echo esc_attr( $option ); ?>" <?php selected( $value, $option ); ?>><?php echo esc_html( $label ); ?></option><?php } ?></select><?php
				break;
			case 'offset':
				?><input id="<?php echo esc_attr( $id ); ?>" type="number" min="0" max="10000" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $value ); ?>"><?php
				break;
			case 'color':
				?><input id="<?php echo esc_attr( $id ); ?>" type="color" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $value ); ?>">
				<button type="button" class="button portal-libras-color" data-color="#005a9c"><?php esc_html_e( 'Restaurar cor padrão', 'portal-video-libras' ); ?></button>
				<div class="portal-libras-swatches"><?php foreach ( $this->palette() as $color => $label ) { ?><button type="button" class="portal-libras-color portal-libras-swatch" data-color="<?php echo esc_attr( $color ); ?>" style="background-color: <?php echo esc_attr( $color ); ?>" aria-label="<?php echo esc_attr( $label ); ?>" title="<?php echo esc_attr( $label ); ?>"></button><?php } ?></div><?php
				break;
			case 'label':
				?><input id="<?php echo esc_attr( $id ); ?>" class="regular-text" type="text" required name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $value ); ?>"><?php
				break;
			case 'post_types':
				?><fieldset><legend class="screen-reader-text"><?php esc_html_e( 'Tipos de conteúdo', 'portal-video-libras' ); ?></legend><?php
				foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $type ) {
					?><label class="portal-libras-post-type"><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[]" value="<?php echo esc_attr( $type->name ); ?>" <?php checked( 'all' === $value || in_array( $type->name, $value, true ) ); ?>> <?php echo esc_html( $type->labels->name ); ?></label><?php
				}
				?></fieldset><?php
				break;
			case 'suppress_vlibras':
				?><label><input id="<?php echo esc_attr( $id ); ?>" type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( $value ); ?>> <?php esc_html_e( 'Ocultar o VLibras quando houver vídeo configurado', 'portal-video-libras' ); ?></label><?php
				break;
		}
	}
}
