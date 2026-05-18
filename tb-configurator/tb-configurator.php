<?php
/**
 * Plugin Name: TB Configurator
 * Plugin URI:  https://github.com/LikeMike151/test
 * Description: Visuele WooCommerce productconfigurator met upsell-systeem en besparingscalculator voor thuisbatterij.nl
 * Version:     3.0.0
 * Author:      Thuisbatterij.nl
 * Text Domain: tb-configurator
 * Requires Plugins: woocommerce
 * GitHub Plugin URI: LikeMike151/test
 * Primary Branch:    main
 * Release Asset:     true
 */

defined( 'ABSPATH' ) || exit;

define( 'TB_CFG_VERSION', '3.0.1' );
define( 'TB_CFG_PATH', plugin_dir_path( __FILE__ ) );
define( 'TB_CFG_URL', plugin_dir_url( __FILE__ ) );

// ============================================================
// AUTO-UPDATES via Plugin Update Checker v5
// ============================================================

require_once TB_CFG_PATH . 'vendor/plugin-update-checker/plugin-update-checker.php';

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$tb_cfg_updater = PucFactory::buildUpdateChecker(
	'https://github.com/LikeMike151/test/',
	__FILE__,
	'tb-configurator'
);
$tb_cfg_updater->getVcsApi()->enableReleaseAssets();

// ============================================================
// ASSETS
// ============================================================

add_action( 'wp_enqueue_scripts', 'tb_cfg_enqueue' );
function tb_cfg_enqueue() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}

	wp_enqueue_style(
		'tb-configurator',
		TB_CFG_URL . 'assets/css/tb-configurator.css',
		[],
		TB_CFG_VERSION
	);

	// Legacy calculator (shortcode use)
	wp_enqueue_script(
		'tb-battery-calc',
		TB_CFG_URL . 'assets/js/tb-battery-calc.js',
		[],
		TB_CFG_VERSION,
		true
	);

	// V3 product configurator
	wp_enqueue_script(
		'tb-v3-configurator',
		TB_CFG_URL . 'assets/js/tb-v3-configurator.js',
		[ 'jquery' ],
		TB_CFG_VERSION,
		true
	);

	wp_localize_script( 'tb-v3-configurator', 'tbCfg', [
		'ajaxUrl' => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'tb_cfg_nonce' ),
		'cartUrl' => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
		'i18n'    => [
			'adding'     => __( 'Toevoegen…', 'tb-configurator' ),
			'added'      => __( 'Toegevoegd!', 'tb-configurator' ),
			'outOfStock' => __( 'Niet op voorraad', 'tb-configurator' ),
			'selectAll'  => __( 'Maak eerst een keuze bij alle stappen', 'tb-configurator' ),
			'ordering'   => __( 'Bestelling wordt verwerkt…', 'tb-configurator' ),
		],
	] );
}

// Admin: meta box JS/CSS
add_action( 'admin_enqueue_scripts', 'tb_cfg_admin_enqueue' );
function tb_cfg_admin_enqueue( $hook ) {
	if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
		return;
	}
	wp_enqueue_script(
		'tb-admin-meta',
		TB_CFG_URL . 'assets/js/tb-admin-meta.js',
		[ 'jquery' ],
		TB_CFG_VERSION,
		true
	);
}

// ============================================================
// V3: VERVANG WC VARIATION FORM OP ALLE VARIABELE PRODUCTEN
// ============================================================

// Body class + gallery suppression must happen before wp_head (body_class too late in summary hook)
add_action( 'wp', 'tb_cfg_v3_early_init' );
function tb_cfg_v3_early_init() {
	if ( ! is_product() ) {
		return;
	}
	$product = wc_get_product( get_the_ID() );
	if ( ! $product || ! $product->is_type( 'variable' ) ) {
		return;
	}

	add_filter( 'body_class', function( $classes ) {
		$classes[] = 'tb-v3-active';
		return $classes;
	} );

	$stack = get_post_meta( $product->get_id(), '_tb_cfg_stack', true );
	if ( $stack ) {
		add_filter( 'body_class', function( $classes ) {
			$classes[] = 'tb-v3-stack-active';
			return $classes;
		} );
		remove_action( 'woocommerce_before_single_product_summary', 'woocommerce_show_product_images', 20 );
	}
}

// Hook into summary at priority 1 so we can remove WC's add-to-cart (priority 30) before it fires.
// This works with both classic themes and Elementor's Single Product widget.
add_action( 'woocommerce_single_product_summary', 'tb_cfg_v3_setup', 1 );
function tb_cfg_v3_setup() {
	global $product;
	if ( ! $product || ! $product->is_type( 'variable' ) ) {
		return;
	}

	// Remove default WooCommerce variation + add-to-cart before it fires at prio 30
	remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );

	// Add our v3 configurator in its place
	add_action( 'woocommerce_single_product_summary', 'tb_cfg_v3_render', 30 );
}

// ============================================================
// V3: RENDER CONFIGURATOR
// ============================================================

function tb_cfg_v3_render() {
	global $product;
	if ( ! $product ) {
		return;
	}

	$pid        = $product->get_id();
	$attributes = $product->get_variation_attributes(); // attr_name => [options]
	$variations = tb_cfg_build_variations_data( $product );
	$upsells    = tb_cfg_get_upsells( $pid );
	$stack_cfg  = tb_cfg_get_stack_config( $pid, $attributes );

	// Inject product data directly — wp_add_inline_script() cannot be called here
	// because scripts are already printed by the time woocommerce_single_product_summary fires.
	echo '<script id="tb-v3-data">var tbV3Data = ' . wp_json_encode( [
		'productId'  => $pid,
		'variations' => $variations,
		'attributes' => tb_cfg_build_attributes_data( $product ),
		'upsells'    => $upsells,
		'stackCfg'   => $stack_cfg,
	] ) . ';</script>' . "\n";

	$has_stack = ! empty( $stack_cfg['enabled'] );
	?>
	<div class="tb-v3-configurator<?php echo $has_stack ? ' tb-v3-has-stack' : ''; ?>"
	     data-product-id="<?php echo esc_attr( $pid ); ?>">

		<div class="tb-v3-layout">

			<?php if ( $has_stack ) : ?>
			<!-- Linkerkolom: visuele productstapel -->
			<div class="tb-v3-col-left">
				<div class="tb-v3-stack-wrap" id="tbStack">
					<div class="tb-stack-blocks" id="tbStackBlocks">
						<!-- Dynamisch gevuld door JS -->
					</div>
					<div class="tb-stack-info">
						<div class="tb-stack-kwh" id="tbStackKwh">0 kWh</div>
						<div class="tb-stack-slots" id="tbStackSlots"></div>
					</div>
				</div>
			</div>
			<?php endif; ?>

			<!-- Rechterkolom: configuratie + cart -->
			<div class="tb-v3-col-right">

				<?php
				$step = 1;
				foreach ( $attributes as $attr_name => $options ) :
					$attr_key  = 'attribute_' . sanitize_title( $attr_name );
					$label     = wc_attribute_label( $attr_name, $product );
					$is_cap    = ( ! empty( $stack_cfg['capacity_attr'] ) && $stack_cfg['capacity_attr'] === $attr_key );
				?>
				<div class="tb-v3-step<?php echo $is_cap ? ' tb-v3-step-capacity' : ''; ?>"
				     data-attr="<?php echo esc_attr( $attr_key ); ?>"
				     data-step="<?php echo esc_attr( $step ); ?>">
					<div class="tb-v3-step-header">
						<span class="tb-v3-step-num"><?php echo esc_html( $step ); ?></span>
						<span class="tb-v3-step-label"><?php echo esc_html( $label ); ?></span>
					</div>
					<div class="tb-v3-options" role="group" aria-label="<?php echo esc_attr( $label ); ?>">
						<?php foreach ( $options as $option ) :
							$term_label = $option;
							if ( taxonomy_exists( $attr_name ) ) {
								$term = get_term_by( 'slug', $option, $attr_name );
								if ( $term && ! is_wp_error( $term ) ) {
									$term_label = $term->name;
								}
							}
						?>
						<button type="button"
						        class="tb-v3-opt"
						        data-value="<?php echo esc_attr( $option ); ?>"
						        data-attr="<?php echo esc_attr( $attr_key ); ?>">
							<?php echo esc_html( $term_label ); ?>
						</button>
						<?php endforeach; ?>
					</div>
					<!-- Hidden select voor WC compat -->
					<select name="<?php echo esc_attr( $attr_key ); ?>"
					        class="tb-v3-hidden-select"
					        data-attribute_name="<?php echo esc_attr( $attr_key ); ?>"
					        style="display:none">
						<option value=""><?php esc_html_e( 'Kies een optie', 'tb-configurator' ); ?></option>
						<?php foreach ( $options as $option ) : ?>
						<option value="<?php echo esc_attr( $option ); ?>"><?php echo esc_html( $option ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<?php
				$step++;
				endforeach;
				?>

				<?php if ( ! empty( $upsells ) ) : ?>
				<!-- Upsell blokken -->
				<?php foreach ( $upsells as $group_key => $group ) : ?>
				<div class="tb-v3-upsell" data-group="<?php echo esc_attr( $group_key ); ?>">
					<div class="tb-v3-upsell-header">
						<span class="tb-v3-step-num"><?php echo esc_html( $step ); ?></span>
						<span class="tb-v3-step-label"><?php echo esc_html( $group['label'] ); ?></span>
						<span class="tb-v3-upsell-badge"><?php esc_html_e( '+ los product', 'tb-configurator' ); ?></span>
					</div>
					<div class="tb-v3-upsell-sub"><?php esc_html_e( 'Wordt los toegevoegd aan winkelwagen', 'tb-configurator' ); ?></div>
					<div class="tb-v3-options" role="group">
						<?php if ( ! empty( $group['none_label'] ) ) : ?>
						<button type="button" class="tb-v3-opt tb-v3-opt-active"
						        data-group="<?php echo esc_attr( $group_key ); ?>"
						        data-product-id="0"
						        data-price="0">
							<?php echo esc_html( $group['none_label'] ); ?>
						</button>
						<?php endif; ?>
						<?php foreach ( $group['options'] as $opt ) : ?>
						<button type="button" class="tb-v3-opt"
						        data-group="<?php echo esc_attr( $group_key ); ?>"
						        data-product-id="<?php echo esc_attr( $opt['product_id'] ); ?>"
						        data-price="<?php echo esc_attr( $opt['price'] ); ?>">
							<?php echo esc_html( $opt['label'] ); ?>
							<?php if ( $opt['price'] > 0 ) : ?>
							<span class="tb-v3-opt-price">+ <?php echo wc_price( $opt['price'] ); // phpcs:ignore ?></span>
							<?php endif; ?>
						</button>
						<?php endforeach; ?>
					</div>
				</div>
				<?php
				$step++;
				endforeach;
				?>
				<?php endif; ?>

				<!-- Cart preview -->
				<div class="tb-v3-cart-preview" id="tbCartPreview">
					<div class="tb-v3-cart-label"><?php esc_html_e( 'Winkelwagen preview', 'tb-configurator' ); ?></div>
					<div class="tb-v3-cart-main" id="tbCartMain">
						<span class="tb-v3-cart-name" id="tbCartMainName"><?php echo esc_html( $product->get_name() ); ?></span>
						<span class="tb-v3-cart-price" id="tbCartMainPrice">—</span>
					</div>
					<div class="tb-v3-cart-upsells" id="tbCartUpsells"></div>
					<div class="tb-v3-cart-divider"></div>
					<div class="tb-v3-cart-total">
						<span><?php esc_html_e( 'Totaal incl. btw', 'tb-configurator' ); ?></span>
						<span class="tb-v3-cart-total-price" id="tbCartTotal">—</span>
					</div>
				</div>

				<!-- CTA knop -->
				<button type="button" class="tb-v3-cta" id="tbCta" disabled>
					<?php esc_html_e( 'Deze thuisbatterij bestellen »', 'tb-configurator' ); ?>
				</button>
				<div class="tb-v3-cta-notice" id="tbCtaNotice" aria-live="polite"></div>

				<!-- Hidden: WC variation_id -->
				<input type="hidden" id="tbVariationId" value="" />

			</div><!-- .tb-v3-col-right -->
		</div><!-- .tb-v3-layout -->
	</div><!-- .tb-v3-configurator -->
	<?php
}

// ============================================================
// HELPERS: BUILD DATA FOR JS
// ============================================================

function tb_cfg_build_variations_data( $product ) {
	$out = [];
	foreach ( $product->get_available_variations() as $v ) {
		$out[] = [
			'id'         => $v['variation_id'],
			'price'      => (float) $v['display_price'],
			'price_html' => $v['price_html'],
			'attributes' => $v['attributes'],
			'in_stock'   => $v['is_in_stock'],
			'image'      => $v['image']['url'] ?? '',
		];
	}
	return $out;
}

function tb_cfg_build_attributes_data( $product ) {
	$out = [];
	foreach ( $product->get_variation_attributes() as $attr_name => $options ) {
		$attr_key = 'attribute_' . sanitize_title( $attr_name );
		$labels   = [];
		foreach ( $options as $slug ) {
			$label = $slug;
			if ( taxonomy_exists( $attr_name ) ) {
				$term = get_term_by( 'slug', $slug, $attr_name );
				if ( $term && ! is_wp_error( $term ) ) {
					$label = $term->name;
				}
			}
			$labels[ $slug ] = $label;
		}
		$out[] = [
			'key'    => $attr_key,
			'label'  => wc_attribute_label( $attr_name, $product ),
			'labels' => $labels,
		];
	}
	return $out;
}

function tb_cfg_get_stack_config( $pid, $attributes ) {
	$enabled  = (bool) get_post_meta( $pid, '_tb_cfg_stack', true );
	$cap_attr = get_post_meta( $pid, '_tb_cfg_capacity_attr', true );
	$inv_attr = get_post_meta( $pid, '_tb_cfg_inverter_attr', true );

	return [
		'enabled'       => $enabled,
		'capacity_attr' => $cap_attr ?: '',
		'inverter_attr' => $inv_attr ?: '',
	];
}

function tb_cfg_get_upsells( $pid ) {
	$raw = get_post_meta( $pid, '_tb_cfg_upsells', true );
	if ( ! $raw ) {
		return [];
	}
	$groups = json_decode( $raw, true );
	if ( ! is_array( $groups ) ) {
		return [];
	}

	// Enrich with live WC prices for each upsell product
	foreach ( $groups as $gk => &$group ) {
		if ( ! isset( $group['options'] ) ) {
			continue;
		}
		foreach ( $group['options'] as &$opt ) {
			if ( empty( $opt['product_id'] ) ) {
				continue;
			}
			$p = wc_get_product( (int) $opt['product_id'] );
			if ( $p ) {
				if ( empty( $opt['price'] ) ) {
					$opt['price'] = (float) $p->get_price();
				}
				if ( empty( $opt['label'] ) ) {
					$opt['label'] = $p->get_name();
				}
			}
		}
		unset( $opt );
	}
	unset( $group );

	return $groups;
}

// ============================================================
// AJAX: MEERDERE PRODUCTEN IN ÉÉN KLIK AAN WINKELWAGEN
// ============================================================

add_action( 'wp_ajax_tb_multi_add_to_cart', 'tb_cfg_ajax_multi_add' );
add_action( 'wp_ajax_nopriv_tb_multi_add_to_cart', 'tb_cfg_ajax_multi_add' );
function tb_cfg_ajax_multi_add() {
	check_ajax_referer( 'tb_cfg_nonce', 'nonce' );

	$items = isset( $_POST['items'] ) ? (array) $_POST['items'] : [];
	if ( empty( $items ) ) {
		wp_send_json_error( [ 'message' => 'Geen producten opgegeven.' ] );
	}

	$added = [];
	foreach ( $items as $item ) {
		$product_id   = absint( $item['product_id'] ?? 0 );
		$variation_id = absint( $item['variation_id'] ?? 0 );
		$quantity     = max( 1, absint( $item['quantity'] ?? 1 ) );
		$variation    = [];

		if ( isset( $item['variation'] ) && is_array( $item['variation'] ) ) {
			foreach ( $item['variation'] as $k => $v ) {
				$variation[ sanitize_text_field( $k ) ] = sanitize_text_field( $v );
			}
		}

		if ( ! $product_id ) {
			continue;
		}

		$result = WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, $variation );
		if ( $result ) {
			$added[] = $product_id;
		}
	}

	if ( empty( $added ) ) {
		$notices = wc_get_notices( 'error' );
		$msg     = ! empty( $notices ) ? wp_strip_all_tags( $notices[0]['notice'] ) : 'Kon producten niet toevoegen.';
		wc_clear_notices();
		wp_send_json_error( [ 'message' => $msg ] );
	}

	WC()->cart->calculate_totals();
	wp_send_json_success( [
		'cart_count' => WC()->cart->get_cart_contents_count(),
		'cart_url'   => wc_get_cart_url(),
		'added'      => $added,
	] );
}

// ============================================================
// ADMIN: META BOX VOOR UPSELL + STACK CONFIGURATIE
// ============================================================

add_action( 'add_meta_boxes', 'tb_cfg_add_meta_box' );
function tb_cfg_add_meta_box() {
	add_meta_box(
		'tb-configurator-settings',
		__( 'TB Configurator', 'tb-configurator' ),
		'tb_cfg_meta_box_render',
		'product',
		'normal',
		'default'
	);
}

function tb_cfg_meta_box_render( $post ) {
	wp_nonce_field( 'tb_cfg_meta_save', 'tb_cfg_meta_nonce' );

	$pid        = $post->ID;
	$product    = wc_get_product( $pid );
	$stack      = get_post_meta( $pid, '_tb_cfg_stack', true );
	$cap_attr   = get_post_meta( $pid, '_tb_cfg_capacity_attr', true );
	$inv_attr   = get_post_meta( $pid, '_tb_cfg_inverter_attr', true );
	$upsells_raw = get_post_meta( $pid, '_tb_cfg_upsells', true );
	$upsells    = $upsells_raw ? json_decode( $upsells_raw, true ) : [];

	// Build attribute list for selects
	$attrs = [];
	if ( $product && $product->is_type( 'variable' ) ) {
		foreach ( $product->get_variation_attributes() as $attr_name => $options ) {
			$key          = 'attribute_' . sanitize_title( $attr_name );
			$attrs[ $key ] = wc_attribute_label( $attr_name, $product );
		}
	}
	?>
	<style>
		.tb-meta-section { margin-bottom: 18px; border-bottom: 1px solid #eee; padding-bottom: 14px; }
		.tb-meta-section h4 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #666; letter-spacing: .06em; }
		.tb-meta-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
		.tb-meta-row label { min-width: 160px; font-weight: 600; font-size: 13px; }
		.tb-meta-row select, .tb-meta-row input[type="text"], .tb-meta-row input[type="number"] { flex: 1; max-width: 300px; }
		.tb-upsell-group { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
		.tb-upsell-group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
		.tb-upsell-option { display: grid; grid-template-columns: 1fr 1fr 100px 30px; gap: 6px; margin-bottom: 6px; align-items: center; }
		.tb-upsell-option input { width: 100%; }
		.tb-btn-small { padding: 4px 10px; font-size: 12px; cursor: pointer; }
		.button-remove { color: #c00; border-color: #c00; }
	</style>

	<div class="tb-meta-section">
		<h4><?php esc_html_e( 'Visuele productstapel', 'tb-configurator' ); ?></h4>
		<div class="tb-meta-row">
			<label><?php esc_html_e( 'Toon visuele stapel', 'tb-configurator' ); ?></label>
			<input type="checkbox" name="tb_cfg_stack" value="1" <?php checked( $stack, '1' ); ?> />
		</div>
		<div class="tb-meta-row">
			<label><?php esc_html_e( 'Capaciteit attribuut', 'tb-configurator' ); ?></label>
			<select name="tb_cfg_capacity_attr">
				<option value=""><?php esc_html_e( '— Geen —', 'tb-configurator' ); ?></option>
				<?php foreach ( $attrs as $key => $lbl ) : ?>
				<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $cap_attr, $key ); ?>><?php echo esc_html( $lbl ); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
		<div class="tb-meta-row">
			<label><?php esc_html_e( 'Omvormer attribuut', 'tb-configurator' ); ?></label>
			<select name="tb_cfg_inverter_attr">
				<option value=""><?php esc_html_e( '— Geen —', 'tb-configurator' ); ?></option>
				<?php foreach ( $attrs as $key => $lbl ) : ?>
				<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $inv_attr, $key ); ?>><?php echo esc_html( $lbl ); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
	</div>

	<div class="tb-meta-section">
		<h4><?php esc_html_e( 'Upsell-producten (los toegevoegd aan winkelwagen)', 'tb-configurator' ); ?></h4>
		<p style="font-size:12px;color:#666;margin:0 0 10px;">
			<?php esc_html_e( 'Voeg groepen toe zoals "Meter" of "Communicatiemodule". Elke groep verschijnt als een aparte stap in de configurator.', 'tb-configurator' ); ?>
		</p>
		<div id="tbUpsellGroups">
			<?php
			if ( ! empty( $upsells ) ) :
				foreach ( $upsells as $gk => $group ) :
					tb_cfg_render_upsell_group_admin( $gk, $group );
				endforeach;
			endif;
			?>
		</div>
		<button type="button" class="button tb-btn-small" id="tbAddGroup">
			<?php esc_html_e( '+ Groep toevoegen', 'tb-configurator' ); ?>
		</button>
		<input type="hidden" name="tb_cfg_upsells" id="tbUpsellsJson" value="<?php echo esc_attr( $upsells_raw ?: '[]' ); ?>" />
	</div>
	<?php
}

function tb_cfg_render_upsell_group_admin( $gk, $group ) {
	?>
	<div class="tb-upsell-group" data-group-key="<?php echo esc_attr( $gk ); ?>">
		<div class="tb-upsell-group-header">
			<strong><?php esc_html_e( 'Groep', 'tb-configurator' ); ?>:</strong>
			<input type="text" class="tb-group-label" value="<?php echo esc_attr( $group['label'] ?? '' ); ?>"
			       placeholder="<?php esc_attr_e( 'bijv. Meter', 'tb-configurator' ); ?>" style="max-width:200px" />
			&nbsp;&nbsp;
			<strong><?php esc_html_e( 'Sla-over tekst', 'tb-configurator' ); ?>:</strong>
			<input type="text" class="tb-group-none" value="<?php echo esc_attr( $group['none_label'] ?? '' ); ?>"
			       placeholder="<?php esc_attr_e( 'bijv. Ik heb er al een', 'tb-configurator' ); ?>" style="max-width:200px" />
			<button type="button" class="button button-small button-remove tb-remove-group"><?php esc_html_e( 'Verwijder groep', 'tb-configurator' ); ?></button>
		</div>
		<div style="display:grid;grid-template-columns:1fr 1fr 120px 30px;gap:6px;margin-bottom:4px;font-size:11px;font-weight:700;color:#666">
			<span><?php esc_html_e( 'Product ID', 'tb-configurator' ); ?></span>
			<span><?php esc_html_e( 'Label', 'tb-configurator' ); ?></span>
			<span><?php esc_html_e( 'Prijs (€)', 'tb-configurator' ); ?></span>
			<span></span>
		</div>
		<div class="tb-upsell-options">
			<?php if ( ! empty( $group['options'] ) ) : ?>
			<?php foreach ( $group['options'] as $opt ) : ?>
			<div class="tb-upsell-option">
				<input type="number" class="tb-opt-pid" value="<?php echo esc_attr( $opt['product_id'] ?? '' ); ?>" placeholder="Product ID" />
				<input type="text" class="tb-opt-label" value="<?php echo esc_attr( $opt['label'] ?? '' ); ?>" placeholder="<?php esc_attr_e( 'Label', 'tb-configurator' ); ?>" />
				<input type="number" class="tb-opt-price" step="0.01" value="<?php echo esc_attr( $opt['price'] ?? '' ); ?>" placeholder="0.00" />
				<button type="button" class="button button-small button-remove tb-remove-option">✕</button>
			</div>
			<?php endforeach; ?>
			<?php endif; ?>
		</div>
		<button type="button" class="button tb-btn-small tb-add-option">+ <?php esc_html_e( 'Optie toevoegen', 'tb-configurator' ); ?></button>
	</div>
	<?php
}

add_action( 'save_post_product', 'tb_cfg_save_meta' );
function tb_cfg_save_meta( $post_id ) {
	if ( ! isset( $_POST['tb_cfg_meta_nonce'] ) || ! wp_verify_nonce( $_POST['tb_cfg_meta_nonce'], 'tb_cfg_meta_save' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	update_post_meta( $post_id, '_tb_cfg_stack', isset( $_POST['tb_cfg_stack'] ) ? '1' : '0' );
	update_post_meta( $post_id, '_tb_cfg_capacity_attr', sanitize_text_field( $_POST['tb_cfg_capacity_attr'] ?? '' ) );
	update_post_meta( $post_id, '_tb_cfg_inverter_attr', sanitize_text_field( $_POST['tb_cfg_inverter_attr'] ?? '' ) );

	$upsells_raw = wp_unslash( $_POST['tb_cfg_upsells'] ?? '[]' );
	$upsells     = json_decode( $upsells_raw, true );
	if ( is_array( $upsells ) ) {
		// Sanitize each entry
		$clean = [];
		foreach ( $upsells as $gk => $group ) {
			$clean_group = [
				'label'      => sanitize_text_field( $group['label'] ?? '' ),
				'none_label' => sanitize_text_field( $group['none_label'] ?? '' ),
				'options'    => [],
			];
			foreach ( (array) ( $group['options'] ?? [] ) as $opt ) {
				$clean_group['options'][] = [
					'product_id' => absint( $opt['product_id'] ?? 0 ),
					'label'      => sanitize_text_field( $opt['label'] ?? '' ),
					'price'      => (float) ( $opt['price'] ?? 0 ),
				];
			}
			$clean[ sanitize_key( $gk ) ] = $clean_group;
		}
		update_post_meta( $post_id, '_tb_cfg_upsells', wp_json_encode( $clean ) );
	}
}

// ============================================================
// BACKWARDS COMPAT: SHORTCODES (V2)
// ============================================================

add_shortcode( 'tb_battery_configurator', 'tb_cfg_full_shortcode' );
function tb_cfg_full_shortcode( $atts ) {
	$atts = shortcode_atts( [ 'category' => '', 'product_id' => '', 'show_calc' => 'yes' ], $atts );
	if ( ! class_exists( 'WooCommerce' ) ) {
		return '<p>WooCommerce is vereist.</p>';
	}
	ob_start();
	tb_cfg_render_full( $atts );
	return ob_get_clean();
}

add_shortcode( 'tb_product_configurator', 'tb_cfg_product_shortcode' );
function tb_cfg_product_shortcode( $atts ) {
	$atts    = shortcode_atts( [ 'id' => '' ], $atts );
	$product = $atts['id'] ? wc_get_product( absint( $atts['id'] ) ) : null;
	if ( ! $product ) {
		return '<p>Product niet gevonden. Geef een geldig ID op: [tb_product_configurator id="123"]</p>';
	}
	ob_start();
	tb_cfg_v3_render_for_product( $product );
	return ob_get_clean();
}

function tb_cfg_render_full( $atts ) {
	// Simplified stub for shortcode use — renders calculator + category grid
	echo '<p>' . esc_html__( 'Gebruik [tb_product_configurator id="X"] voor een volledig product, of open een productpagina.', 'tb-configurator' ) . '</p>';
}

function tb_cfg_render_for_product( $product ) {
	// Temporarily set global product for the render function
	$backup              = isset( $GLOBALS['product'] ) ? $GLOBALS['product'] : null;
	$GLOBALS['product']  = $product;
	tb_cfg_v3_render();
	$GLOBALS['product']  = $backup;
}
