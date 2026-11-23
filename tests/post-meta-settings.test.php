<?php

require_once __DIR__ . '/../includes/class-settings.php';
require_once __DIR__ . '/../includes/class-post-meta.php';

define( 'PORTAL_VIDEO_LIBRAS_PATH', dirname( __DIR__ ) . '/' );
define( 'PORTAL_VIDEO_LIBRAS_URL', 'https://example.test/plugin/' );
define( 'PORTAL_VIDEO_LIBRAS_VERSION', '1' );

$settings = array( 'post_types' => array( 'post' ) );
$registered = array();
$boxes = array();
$scripts = array();
$screen = (object) array( 'base' => 'post', 'post_type' => 'post' );
class WP_Post {}
function __( $text, $domain ) { return $text; }
function get_option( $key, $default ) { global $settings; return $settings; }
function is_multisite() { return false; }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( $key ) ); }
function get_post_type_object( $type ) { return (object) array( 'public' => true ); }
function get_post_types( $args, $output ) { return array( 'post', 'page' ); }
function add_post_type_support( $type, $feature ) {}
function add_action( $hook, $callback, $priority = 10, $args = 1 ) {}
function add_filter( $hook, $callback, $priority = 10, $args = 1 ) {}
function register_post_meta( $type, $key, $args ) { global $registered; $registered[] = $type; }
function use_block_editor_for_post( $post ) { return false; }
function use_block_editor_for_post_type( $type ) { return true; }
function add_meta_box( $id, $title, $callback, $type ) { global $boxes; $boxes[] = $type; }
function get_current_screen() { global $screen; return $screen; }
function wp_enqueue_script( $handle ) { global $scripts; $scripts[] = $handle; }
function wp_set_script_translations( $handle, $domain, $path ) {}
function check( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$meta = new \PortalVideoLibras\Post_Meta();
$meta->register_existing_post_types();
$meta->register_post_type( 'page' );
check( array( 'post' ) === $registered, 'Only enabled types should register metadata.' );
$meta->add_meta_box( 'post', new WP_Post() );
$meta->add_meta_box( 'page', new WP_Post() );
check( array( 'post' ) === $boxes, 'Only enabled types should receive classic meta boxes.' );
$meta->enqueue_editor_assets();
$screen->post_type = 'page';
$meta->enqueue_editor_assets();
check( array( 'portal-video-libras-editor' ) === $scripts, 'Only enabled types should load the Gutenberg panel.' );
echo "Post type settings checks passed.\n";
