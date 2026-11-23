<?php

require_once __DIR__ . '/../includes/class-settings.php';

use PortalVideoLibras\Settings;

$multisite = false;
$network_admin = false;
$site = array();
$network = array();
$errors = array();

function __( $text, $domain ) { return $text; }
function is_multisite() { global $multisite; return $multisite; }
function is_network_admin() { global $network_admin; return $network_admin; }
function get_option( $key, $default ) { global $site; return $site; }
function get_site_option( $key, $default ) { global $network; return $network; }
function sanitize_hex_color( $color ) { return preg_match( '/^#(?:[a-f0-9]{3}){1,2}$/i', $color ) ? $color : null; }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( $key ) ); }
function sanitize_text_field( $value ) { return trim( strip_tags( $value ) ); }
function get_post_types( $args, $output ) { return array( 'post', 'page', 'book' ); }
function add_settings_error( $setting, $code, $message, $type ) { global $errors; $errors[] = $code; }
function check( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

check( 'bottom' === Settings::get_option( 'position' ), 'Standalone defaults missing.' );
check( Settings::post_type_enabled( 'new_type' ), 'All public types should be enabled by default.' );
$network = array( 'position' => 'top', 'width' => 'large' );
$site = array( 'position' => 'middle' );
check( 'middle' === Settings::get_option( 'position' ), 'Standalone site setting ignored.' );
check( 'standard' === Settings::get_option( 'width' ), 'Standalone must not use network options.' );
$multisite = true;
check( 'middle' === Settings::get_option( 'position' ), 'Site override ignored.' );
check( 'large' === Settings::get_option( 'width' ), 'Missing site key must fall back to network.' );
$site['inherit'] = true;
check( 'top' === Settings::get_option( 'position' ), 'Inheritance ignored.' );
check( '#005a9c' === Settings::get_option( 'color' ), 'Missing network value must use default.' );
$site = array( 'position' => '<bad>', 'post_types' => array( 'post' ) );
check( 'top' === Settings::get_option( 'position' ), 'Invalid stored value must fall back.' );
check( Settings::post_type_enabled( 'post' ) && ! Settings::post_type_enabled( 'page' ), 'Enabled post types ignored.' );

$settings = new Settings();
$result = $settings->sanitize( array(
	'position' => 'middle',
	'offset' => '30',
	'color' => '#abc',
	'width' => 'compact',
	'label' => '<b>Tradução</b>',
	'post_types' => array( 'book', 'private', array( 'bad' ) ),
	'inherit' => '1',
) );
check( '#aabbcc' === $result['color'] && 30 === $result['offset'], 'Valid settings not sanitized.' );
check( array( 'book' ) === $result['post_types'], 'Invalid post types were accepted.' );
check( array( 'invalid_post_types' ) === $errors, 'Invalid post types should be reported.' );
check( 'Tradução' === $result['label'] && $result['inherit'] && ! $result['suppress_vlibras'], 'Checkbox or label sanitization failed.' );
$errors = array();
$network_admin = true;
$result = $settings->sanitize( array( 'position' => 'TOP', 'offset' => '-5', 'color' => 'red', 'width' => '999', 'label' => '' ) );
check( ! isset( $result['inherit'] ) && count( $errors ) === 5, 'Invalid values should be reported.' );
check( 'bottom' === $result['position'] && '#005a9c' === $result['color'], 'Invalid values should use safe defaults.' );
check( array() === $result['post_types'], 'No selected post types must remain empty.' );

for ( $r = 0; $r <= 255; $r += 15 ) {
	for ( $g = 0; $g <= 255; $g += 15 ) {
		for ( $b = 0; $b <= 255; $b += 15 ) {
			$color = sprintf( '#%02x%02x%02x', $r, $g, $b );
			$channels = array_map( static function ( $channel ) {
				$value = $channel / 255;
				return $value <= 0.04045 ? $value / 12.92 : pow( ( $value + 0.055 ) / 1.055, 2.4 );
			}, array( $r, $g, $b ) );
			$luminance = 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
			$dark = pow( ( 17 / 255 + 0.055 ) / 1.055, 2.4 );
			$foreground = Settings::foreground( $color );
			$ratio = '#ffffff' === $foreground ? 1.05 / ( $luminance + 0.05 ) : ( $luminance + 0.05 ) / ( ( '#000000' === $foreground ? 0 : $dark ) + 0.05 );
			check( $ratio >= 4.5, 'Foreground failed WCAG AA for ' . $color );
		}
		check( '#000000' === Settings::foreground( '#0078e1' ), 'Colors in the contrast gap require black.' );
	}
}
echo "Settings checks passed.\n";
