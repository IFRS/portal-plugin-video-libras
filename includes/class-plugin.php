<?php
/**
 * Plugin bootstrap.
 *
 * @package PortalVideoLibras
 */

namespace PortalVideoLibras;

/**
 * Registers the plugin services.
 */
final class Plugin {

	/**
	 * Plugin instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Returns the plugin instance.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Hooks plugin services into WordPress.
	 *
	 * @return void
	 */
	public function register_hooks() {
		( new Post_Meta() )->register_hooks();
		( new Frontend() )->register_hooks();
	}
}
