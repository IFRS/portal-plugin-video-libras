<?php
/**
 * LIBRAS video post meta and editor integration.
 *
 * @package PortalVideoLibras
 */

namespace PortalVideoLibras;

/**
 * Registers and manages the LIBRAS video URL.
 */
final class Post_Meta {

	const META_KEY   = 'portal_libras_video_url';
	const META_BOX   = 'portal_libras_video_url';
	const NONCE_NAME = 'portal_libras_video_nonce';
	const NONCE_ACTION = 'portal_libras_video_save';

	/**
	 * Hooks metadata and editor integration into WordPress.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register_existing_post_types' ), 99 );
		add_action( 'registered_post_type', array( $this, 'register_post_type' ), 10, 1 );
		add_action( 'add_meta_boxes', array( $this, 'add_meta_box' ), 10, 2 );
		add_action( 'save_post', array( $this, 'save_meta_box' ), 10, 2 );
		add_action( 'admin_notices', array( $this, 'show_invalid_url_notice' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
	}

	/**
	 * Registers the meta key for all public post types already registered.
	 *
	 * @return void
	 */
	public function register_existing_post_types() {
		$post_types = get_post_types( array( 'public' => true ), 'names' );

		foreach ( $post_types as $post_type ) {
			$this->register_post_type( $post_type );
		}
	}

	/**
	 * Adds custom-fields support and registers the shared REST meta field.
	 *
	 * @param string $post_type Post type name.
	 * @return void
	 */
	public function register_post_type( $post_type ) {
		$post_type_object = get_post_type_object( $post_type );

		if ( ! $post_type_object || ! $post_type_object->public ) {
			return;
		}

		add_post_type_support( $post_type, 'custom-fields' );
		add_action(
			'rest_after_insert_' . $post_type,
			array( $this, 'delete_empty_rest_meta' ),
			10,
			3
		);
		add_filter(
			'rest_pre_insert_' . $post_type,
			array( $this, 'validate_rest_meta' ),
			10,
			2
		);

		register_post_meta(
			$post_type,
			self::META_KEY,
			array(
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => array(
					'schema' => array(
						'type'    => 'string',
						'context' => array( 'view', 'edit' ),
					),
				),
				'sanitize_callback' => array( __CLASS__, 'sanitize_url' ),
				'auth_callback'     => array( __CLASS__, 'authorize_meta' ),
			)
		);
	}

	/**
	 * Authorizes editing this meta value.
	 *
	 * @param bool   $allowed  Whether the user can edit the meta value.
	 * @param string $meta_key Meta key.
	 * @param int    $post_id  Post ID.
	 * @return bool
	 */
	public static function authorize_meta( $allowed, $meta_key, $post_id ) {
		return current_user_can( 'edit_post', $post_id );
	}

	/**
	 * Sanitizes a URL, returning an empty value for invalid input.
	 *
	 * @param string $value Submitted meta value.
	 * @return string
	 */
	public static function sanitize_url( $value ) {
		if ( ! is_string( $value ) ) {
			return '';
		}

		$url = esc_url_raw( trim( $value ), array( 'http', 'https' ) );

		return self::is_valid_url( $url ) ? $url : '';
	}

	/**
	 * Checks that a URL is an absolute HTTP or HTTPS URL.
	 *
	 * @param string $url URL to validate.
	 * @return bool
	 */
	public static function is_valid_url( $url ) {
		if ( ! is_string( $url ) || '' === $url || ! filter_var( $url, FILTER_VALIDATE_URL ) ) {
			return false;
		}

		$scheme = wp_parse_url( $url, PHP_URL_SCHEME );

		return in_array( strtolower( (string) $scheme ), array( 'http', 'https' ), true );
	}

	/**
	 * Removes the stored value when Gutenberg submits an empty meta field.
	 *
	 * @param \WP_Post         $post    Saved post.
	 * @param \WP_REST_Request $request REST request.
	 * @param bool             $creating Whether the post is being created.
	 * @return void
	 */
	public function delete_empty_rest_meta( $post, $request, $creating ) {
		unset( $creating );

		if ( ! $post instanceof \WP_Post || ! $request instanceof \WP_REST_Request ) {
			return;
		}

		$meta = $request->get_param( 'meta' );

		if (
			is_array( $meta )
			&& isset( $meta[ self::META_KEY ] )
			&& is_string( $meta[ self::META_KEY ] )
			&& '' === trim( $meta[ self::META_KEY ] )
		) {
			delete_post_meta( $post->ID, self::META_KEY );
		}
	}

	/**
	 * Rejects invalid REST meta values before WordPress saves the post.
	 *
	 * @param \stdClass|\WP_Error $prepared_post Prepared post data or an error.
	 * @param \WP_REST_Request    $request       REST request.
	 * @return \stdClass|\WP_Error
	 */
	public function validate_rest_meta( $prepared_post, $request ) {
		if ( is_wp_error( $prepared_post ) ) {
			return $prepared_post;
		}

		$meta = $request->get_param( 'meta' );

		if ( ! is_array( $meta ) || ! array_key_exists( self::META_KEY, $meta ) ) {
			return $prepared_post;
		}

		$value = $meta[ self::META_KEY ];

		if ( is_string( $value ) && '' === trim( $value ) ) {
			return $prepared_post;
		}

		if ( ! is_string( $value ) || ! self::is_valid_url( $value ) ) {
			return new \WP_Error(
				'rest_invalid_libras_video_url',
				__( 'Informe uma URL HTTP ou HTTPS válida para o vídeo em LIBRAS.', 'portal-video-libras' ),
				array( 'status' => 400 )
			);
		}

		return $prepared_post;
	}

	/**
	 * Adds the classic editor fallback meta box.
	 *
	 * @param string  $post_type Post type name.
	 * @param \WP_Post $post     Current post.
	 * @return void
	 */
	public function add_meta_box( $post_type, $post ) {
		if ( ! $post instanceof \WP_Post || use_block_editor_for_post( $post ) ) {
			return;
		}

		$post_type_object = get_post_type_object( $post_type );

		if ( ! $post_type_object || ! $post_type_object->public ) {
			return;
		}

		add_meta_box(
			self::META_BOX,
			__( 'Vídeo em LIBRAS', 'portal-video-libras' ),
			array( $this, 'render_meta_box' ),
			$post_type,
			'side',
			'default',
			array( '__back_compat_meta_box' => true )
		);
	}

	/**
	 * Renders the classic editor URL field.
	 *
	 * @param \WP_Post $post Current post.
	 * @return void
	 */
	public function render_meta_box( $post ) {
		$value = get_post_meta( $post->ID, self::META_KEY, true );
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_NAME );
		?>
		<p>
			<label for="portal-libras-video-url">
				<?php esc_html_e( 'URL do vídeo em LIBRAS', 'portal-video-libras' ); ?>
			</label>
		</p>
		<input
			class="widefat"
			type="url"
			id="portal-libras-video-url"
			name="<?php echo esc_attr( self::META_KEY ); ?>"
			value="<?php echo esc_attr( $value ); ?>"
			placeholder="https://"
		/>
		<p class="description">
			<?php esc_html_e( 'Informe uma URL HTTP ou HTTPS. Deixe vazio para remover o vídeo.', 'portal-video-libras' ); ?>
		</p>
		<?php
	}

	/**
	 * Saves the classic editor field.
	 *
	 * @param int     $post_id Post ID.
	 * @param \WP_Post $post   Post object.
	 * @return void
	 */
	public function save_meta_box( $post_id, $post ) {
		if (
			! $post instanceof \WP_Post
			|| ! get_post_type_object( $post->post_type )
			|| ! get_post_type_object( $post->post_type )->public
			|| ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE )
			|| wp_is_post_revision( $post_id )
			|| wp_is_post_autosave( $post_id )
			|| ! isset( $_POST[ self::NONCE_NAME ] )
		) {
			return;
		}

		$nonce = sanitize_text_field( wp_unslash( $_POST[ self::NONCE_NAME ] ) );

		if ( ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		if ( ! isset( $_POST[ self::META_KEY ] ) ) {
			return;
		}

		$raw_value = wp_unslash( $_POST[ self::META_KEY ] );

		if ( ! is_string( $raw_value ) ) {
			set_transient( $this->get_notice_transient_key(), true, MINUTE_IN_SECONDS );
			return;
		}

		if ( '' === trim( $raw_value ) ) {
			delete_post_meta( $post_id, self::META_KEY );
			return;
		}

		$url = self::sanitize_url( $raw_value );

		if ( '' === $url ) {
			set_transient( $this->get_notice_transient_key(), true, MINUTE_IN_SECONDS );
			return;
		}

		update_post_meta( $post_id, self::META_KEY, $url );
	}

	/**
	 * Shows a one-time notice after an invalid URL is submitted in the classic editor.
	 *
	 * @return void
	 */
	public function show_invalid_url_notice() {
		$transient_key = $this->get_notice_transient_key();

		if ( ! get_transient( $transient_key ) ) {
			return;
		}

		delete_transient( $transient_key );
		?>
		<div class="notice notice-error is-dismissible">
			<p>
				<?php esc_html_e( 'A URL do vídeo em LIBRAS não foi salva. Informe uma URL HTTP ou HTTPS válida.', 'portal-video-libras' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Enqueues the Gutenberg sidebar panel.
	 *
	 * @return void
	 */
	public function enqueue_editor_assets() {
		$screen = get_current_screen();

		if (
			! $screen
			|| 'post' !== $screen->base
			|| empty( $screen->post_type )
			|| ! use_block_editor_for_post_type( $screen->post_type )
		) {
			return;
		}

		$asset_file = PORTAL_VIDEO_LIBRAS_PATH . 'assets/build/editor.asset.php';
		$asset      = file_exists( $asset_file )
			? require $asset_file
			: array(
				'dependencies' => array(
					'wp-plugins',
					'wp-editor',
					'wp-components',
					'wp-core-data',
					'wp-data',
					'wp-element',
					'wp-i18n',
				),
				'version'      => PORTAL_VIDEO_LIBRAS_VERSION,
			);

		wp_enqueue_script(
			'portal-video-libras-editor',
			PORTAL_VIDEO_LIBRAS_URL . 'assets/build/editor.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_set_script_translations(
			'portal-video-libras-editor',
			'portal-video-libras',
			PORTAL_VIDEO_LIBRAS_PATH . 'languages'
		);
	}

	/**
	 * Gets the current user's classic-editor notice key.
	 *
	 * @return string
	 */
	private function get_notice_transient_key() {
		return 'portal_libras_invalid_url_' . get_current_user_id();
	}
}
