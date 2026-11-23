<?php

require_once __DIR__ . '/../includes/class-post-meta.php';
require_once __DIR__ . '/../includes/class-frontend.php';

$hooks = array();
$removed = array();
$scripts = array();
$styles = array();
$singular = true;
$post_id = 1;
$video_url = '';

function add_action( $hook, $callback, $priority = 10 ) {
	global $hooks;
	$hooks[ $hook ][ $priority ][] = $callback;
}

function add_filter( $hook, $callback, $priority = 10 ) {
	add_action( $hook, $callback, $priority );
}

function remove_action( $hook, $callback, $priority = 10 ) {
	global $removed;
	$removed[] = array( $hook, $callback, $priority );
}

function is_singular() {
	global $singular;
	return $singular;
}

function get_queried_object_id() {
	global $post_id;
	return $post_id;
}

function get_post_meta( $id, $key, $single ) {
	global $video_url;
	return $video_url;
}

function wp_parse_url( $url, $component ) {
	return parse_url( $url, $component );
}

function esc_url( $url, $protocols ) {
	return $url;
}

function wp_dequeue_script( $handle ) {
	global $scripts;
	$scripts[] = $handle;
}

function wp_dequeue_style( $handle ) {
	global $styles;
	$styles[] = $handle;
}

function check( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$frontend = new \PortalVideoLibras\Frontend();
$frontend->register_hooks();
check( isset( $hooks['wp'][10], $hooks['wp_enqueue_scripts'][999], $hooks['body_class'][10] ), 'Required hooks are not registered.' );

foreach ( array(
	array( true, 1, 'https://example.com/video.mp4', true ),
	array( true, 1, '', false ),
	array( true, 1, 'not-a-url', false ),
	array( true, 1, 'ftp://example.com/video.mp4', false ),
	array( false, 1, 'https://example.com/video.mp4', false ),
	array( true, 0, 'https://example.com/video.mp4', false ),
) as $case ) {
	list( $singular, $post_id, $video_url, $active ) = $case;
	$removed = array();
	$scripts = array();
	$styles = array();
	$frontend->remove_vlibras_hooks();
	$frontend->dequeue_vlibras_assets();
	$classes = $frontend->add_video_body_class( array( 'existing' ) );

	check( in_array( 'has-portal-video-libras', $classes, true ) === $active, 'Incorrect body class.' );
	check( in_array( 'existing', $classes, true ), 'Existing body class was lost.' );
	check(
		$removed === ( $active ? array(
			array( 'wp_footer', 'vlibras_widget', 10 ),
			array( 'wp_enqueue_scripts', 'vlibras_enqueue', 10 ),
		) : array() ),
		'Incorrect VLibras hook removal.'
	);
	$expected = $active ? array( 'vlibrasjs', 'vlibras-plugin', 'vlibras' ) : array();
	check( $scripts === $expected && $styles === $expected, 'Incorrect VLibras asset dequeue.' );
}

echo "Frontend VLibras checks passed.\n";
