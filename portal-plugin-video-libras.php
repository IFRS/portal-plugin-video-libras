<?php
/**
 * Plugin Name: Portal - Vídeo em LIBRAS
 * Description: Adiciona um player flutuante de vídeos em LIBRAS aos conteúdos do site.
 * Version: 1.0.1
 * Requires at least: 6.1
 * Requires PHP: 7.4
 * Text Domain: portal-video-libras
 *
 * @package PortalVideoLibras
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PORTAL_VIDEO_LIBRAS_VERSION', '1.0.1' );
define( 'PORTAL_VIDEO_LIBRAS_FILE', __FILE__ );
define( 'PORTAL_VIDEO_LIBRAS_PATH', plugin_dir_path( __FILE__ ) );
define( 'PORTAL_VIDEO_LIBRAS_URL', plugin_dir_url( __FILE__ ) );

require_once PORTAL_VIDEO_LIBRAS_PATH . 'includes/class-settings.php';
require_once PORTAL_VIDEO_LIBRAS_PATH . 'includes/class-post-meta.php';
require_once PORTAL_VIDEO_LIBRAS_PATH . 'includes/class-frontend.php';
require_once PORTAL_VIDEO_LIBRAS_PATH . 'includes/class-plugin.php';

\PortalVideoLibras\Plugin::instance()->register_hooks();
