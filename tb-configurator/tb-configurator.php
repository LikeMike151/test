<?php
/**
 * Plugin Name: TB Configurator
 * Plugin URI:  https://thuisbatterij.nl
 * Description: Batterij-configurator met visuele WooCommerce variatie-selector en besparingsberekening. Shortcodes: [tb_battery_configurator], [tb_product_configurator id="X"]
 * Version:     2.0.0
 * Author:      Thuisbatterij.nl
 * Text Domain: tb-configurator
 * Requires Plugins: woocommerce
 */

defined( 'ABSPATH' ) || exit;

define( 'TB_CFG_VERSION', '2.1.0' );
define( 'TB_CFG_PATH', plugin_dir_path( __FILE__ ) );
define( 'TB_CFG_URL', plugin_dir_url( __FILE__ ) );

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

	wp_enqueue_script(
		'tb-battery-calc',
		TB_CFG_URL . 'assets/js/tb-battery-calc.js',
		[],
		TB_CFG_VERSION,
		true
	);

	wp_enqueue_script(
		'tb-configurator',
		TB_CFG_URL . 'assets/js/tb-configurator.js',
		[ 'jquery', 'tb-battery-calc' ],
		TB_CFG_VERSION,
		true
	);

	wp_localize_script( 'tb-configurator', 'tbCfg', [
		'ajaxUrl' => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'tb_cfg_nonce' ),
		'cartUrl' => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
		'i18n'    => [
			'addToCart'     => __( 'In winkelwagen', 'tb-configurator' ),
			'adding'        => __( 'Toevoegen…', 'tb-configurator' ),
			'added'         => __( 'Toegevoegd!', 'tb-configurator' ),
			'selectOptions' => __( 'Selecteer opties', 'tb-configurator' ),
			'outOfStock'    => __( 'Niet op voorraad', 'tb-configurator' ),
			'viewCart'      => __( 'Bekijk winkelwagen', 'tb-configurator' ),
		],
	] );
}

// ============================================================
// WC PRODUCT PAGE: vervang dropdown selects door button-groepen
// ============================================================

add_filter( 'woocommerce_dropdown_variation_attribute_options_html', 'tb_cfg_variation_dropdown_html', 20, 2 );
function tb_cfg_variation_dropdown_html( $html, $args ) {
	if ( empty( $args['options'] ) || empty( $args['attribute'] ) ) {
		return $html;
	}

	$product   = $args['product'];
	$attribute = $args['attribute'];
	$selected  = $args['selected'] ?? '';
	$name      = 'attribute_' . sanitize_title( $attribute );
	$id        = sanitize_title( $attribute ) . '-' . ( $product ? $product->get_id() : 'x' );
	$label     = wc_attribute_label( $attribute, $product );

	// Originele select hidden houden voor WC-compatibiliteit
	$orig = sprintf(
		'<select id="%s" name="%s" data-attribute_name="%s" class="tb-hidden-select" style="display:none">',
		esc_attr( $id ),
		esc_attr( $name ),
		esc_attr( $name )
	);
	$orig .= '<option value="">' . esc_html__( 'Kies een optie', 'tb-configurator' ) . '</option>';
	foreach ( $args['options'] as $option ) {
		$orig .= sprintf(
			'<option value="%s"%s>%s</option>',
			esc_attr( $option ),
			selected( $selected, $option, false ),
			esc_html( $option )
		);
	}
	$orig .= '</select>';

	// Knoppengroep
	$buttons = '<div class="tb-btn-group" data-attr="' . esc_attr( $name ) . '">';
	foreach ( $args['options'] as $option ) {
		// Converteer taxonomie-slug naar echte weergavenaam
		$label_text = $option;
		if ( taxonomy_exists( $attribute ) ) {
			$term = get_term_by( 'slug', $option, $attribute );
			if ( $term && ! is_wp_error( $term ) ) {
				$label_text = $term->name;
			}
		}

		$active   = $selected === $option ? ' tb-active' : '';
		$buttons .= sprintf(
			'<button type="button" class="tb-opt-btn%s" data-value="%s" data-select-id="%s">%s</button>',
			$active,
			esc_attr( $option ),
			esc_attr( $id ),
			esc_html( $label_text )
		);
	}
	$buttons .= '</div>';

	return $orig . $buttons;
}

// Body-class zodat CSS productpagina-specifieke stijlen kan toepassen
add_action( 'woocommerce_before_single_product', 'tb_cfg_mark_product_page' );
function tb_cfg_mark_product_page() {
	add_filter( 'body_class', function( $classes ) {
		$classes[] = 'tb-product-page';
		return $classes;
	} );
}

// Inklapbare calculator onder het product (na de afbeeldingen, vóór tabs)
add_action( 'woocommerce_after_single_product_summary', 'tb_cfg_product_page_calculator', 5 );
function tb_cfg_product_page_calculator() {
	if ( ! is_product() ) {
		return;
	}
	?>
	<div class="tb-product-calc-section">
		<button type="button" class="tb-product-calc-toggle" id="tbProductCalcToggle" aria-expanded="false">
			<span class="tb-toggle-icon">🔋</span>
			<?php esc_html_e( 'Bereken jouw besparing', 'tb-configurator' ); ?>
			<span class="tb-toggle-arrow" aria-hidden="true">▾</span>
		</button>
		<div class="tb-product-calc-body" id="tbProductCalcBody" style="display:none">
			<?php tb_cfg_render_calculator(); ?>
		</div>
	</div>
	<?php
}

// ============================================================
// SHORTCODE: [tb_battery_configurator category="slug" product_id="123" show_calc="yes"]
// ============================================================

add_shortcode( 'tb_battery_configurator', 'tb_cfg_full_shortcode' );
function tb_cfg_full_shortcode( $atts ) {
	$atts = shortcode_atts( [
		'category'   => '',
		'product_id' => '',
		'show_calc'  => 'yes',
	], $atts, 'tb_battery_configurator' );

	if ( ! class_exists( 'WooCommerce' ) ) {
		return '<p>' . esc_html__( 'WooCommerce is vereist.', 'tb-configurator' ) . '</p>';
	}

	ob_start();
	tb_cfg_render_full( $atts );
	return ob_get_clean();
}

// ============================================================
// SHORTCODE: [tb_product_configurator id="123"]
// ============================================================

add_shortcode( 'tb_product_configurator', 'tb_cfg_product_shortcode' );
function tb_cfg_product_shortcode( $atts ) {
	$atts = shortcode_atts( [ 'id' => '' ], $atts, 'tb_product_configurator' );

	if ( ! class_exists( 'WooCommerce' ) ) {
		return '<p>' . esc_html__( 'WooCommerce is vereist.', 'tb-configurator' ) . '</p>';
	}
	if ( ! $atts['id'] ) {
		return '<p>' . esc_html__( 'Geef een product ID op: [tb_product_configurator id="123"]', 'tb-configurator' ) . '</p>';
	}

	$product = wc_get_product( absint( $atts['id'] ) );
	if ( ! $product ) {
		return '<p>' . esc_html__( 'Product niet gevonden.', 'tb-configurator' ) . '</p>';
	}

	ob_start();
	tb_cfg_render_product( $product );
	return ob_get_clean();
}

// ============================================================
// AJAX: variaties ophalen
// ============================================================

add_action( 'wp_ajax_tb_get_variations', 'tb_cfg_ajax_variations' );
add_action( 'wp_ajax_nopriv_tb_get_variations', 'tb_cfg_ajax_variations' );
function tb_cfg_ajax_variations() {
	check_ajax_referer( 'tb_cfg_nonce', 'nonce' );

	$product_id = absint( $_POST['product_id'] ?? 0 );
	if ( ! $product_id ) {
		wp_send_json_error( 'Geen product ID' );
	}

	$product = wc_get_product( $product_id );
	if ( ! $product || ! $product->is_type( 'variable' ) ) {
		wp_send_json_error( 'Geen variabel product' );
	}

	$out = [];
	foreach ( $product->get_available_variations() as $v ) {
		$out[] = [
			'id'          => $v['variation_id'],
			'price_html'  => $v['price_html'],
			'price'       => $v['display_price'],
			'sku'         => $v['sku'],
			'image'       => $v['image']['url'] ?? '',
			'thumb'       => $v['image']['gallery_thumbnail_src'] ?? ( $v['image']['url'] ?? '' ),
			'attributes'  => $v['attributes'],
			'in_stock'    => $v['is_in_stock'],
			'max_qty'     => $v['max_qty'],
		];
	}

	wp_send_json_success( [ 'variations' => $out ] );
}

// ============================================================
// AJAX: producten per categorie ophalen
// ============================================================

add_action( 'wp_ajax_tb_get_products', 'tb_cfg_ajax_products' );
add_action( 'wp_ajax_nopriv_tb_get_products', 'tb_cfg_ajax_products' );
function tb_cfg_ajax_products() {
	check_ajax_referer( 'tb_cfg_nonce', 'nonce' );

	$category    = sanitize_text_field( $_POST['category'] ?? '' );
	$product_ids = array_map( 'absint', (array) ( $_POST['product_ids'] ?? [] ) );

	$args = [
		'status' => 'publish',
		'limit'  => 24,
		'type'   => [ 'simple', 'variable' ],
	];

	if ( $category ) {
		$args['category'] = [ $category ];
	} elseif ( $product_ids ) {
		$args['include'] = $product_ids;
	}

	$products = wc_get_products( $args );
	$data     = [];

	foreach ( $products as $p ) {
		$capacity = tb_cfg_get_capacity( $p );

		$item = [
			'id'           => $p->get_id(),
			'name'         => $p->get_name(),
			'type'         => $p->get_type(),
			'price_html'   => $p->get_price_html(),
			'image'        => wp_get_attachment_image_url( $p->get_image_id(), 'woocommerce_single' ) ?: wc_placeholder_img_src( 'woocommerce_single' ),
			'short_desc'   => wp_strip_all_tags( $p->get_short_description() ),
			'permalink'    => get_permalink( $p->get_id() ),
			'capacity_kwh' => $capacity,
			'attributes'   => [],
		];

		if ( $p->is_type( 'variable' ) ) {
			foreach ( $p->get_variation_attributes() as $attr_name => $options ) {
				$item['attributes'][] = [
					'name'    => 'attribute_' . sanitize_title( $attr_name ),
					'label'   => wc_attribute_label( $attr_name, $p ),
					'options' => array_values( array_filter( $options ) ),
				];
			}
		}

		$data[] = $item;
	}

	wp_send_json_success( [ 'products' => $data ] );
}

// ============================================================
// AJAX: in winkelwagen
// ============================================================

add_action( 'wp_ajax_tb_add_to_cart', 'tb_cfg_ajax_add_to_cart' );
add_action( 'wp_ajax_nopriv_tb_add_to_cart', 'tb_cfg_ajax_add_to_cart' );
function tb_cfg_ajax_add_to_cart() {
	check_ajax_referer( 'tb_cfg_nonce', 'nonce' );

	$product_id   = absint( $_POST['product_id'] ?? 0 );
	$variation_id = absint( $_POST['variation_id'] ?? 0 );
	$quantity     = max( 1, absint( $_POST['quantity'] ?? 1 ) );
	$variation    = [];

	if ( isset( $_POST['variation'] ) && is_array( $_POST['variation'] ) ) {
		foreach ( $_POST['variation'] as $key => $val ) {
			$variation[ sanitize_text_field( $key ) ] = sanitize_text_field( $val );
		}
	}

	if ( ! $product_id ) {
		wp_send_json_error( [ 'message' => 'Geen product ID' ] );
	}

	$result = WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, $variation );

	if ( $result ) {
		WC()->cart->calculate_totals();

		ob_start();
		woocommerce_mini_cart();
		$mini_cart = ob_get_clean();

		wp_send_json_success( [
			'cart_count' => WC()->cart->get_cart_contents_count(),
			'cart_url'   => wc_get_cart_url(),
			'message'    => __( 'Product toegevoegd aan winkelwagen!', 'tb-configurator' ),
			'mini_cart'  => $mini_cart,
		] );
	} else {
		$notices = wc_get_notices( 'error' );
		$msg     = ! empty( $notices ) ? wp_strip_all_tags( $notices[0]['notice'] ) : __( 'Kon product niet toevoegen.', 'tb-configurator' );
		wc_clear_notices();
		wp_send_json_error( [ 'message' => $msg ] );
	}
}

// ============================================================
// HELPERS
// ============================================================

function tb_cfg_get_capacity( $product ) {
	// 1. Product meta _tb_capacity_kwh
	$cap = (float) $product->get_meta( '_tb_capacity_kwh' );
	if ( $cap > 0 ) {
		return $cap;
	}

	// 2. Attribuut met "capacit" of "kwh" in de naam
	foreach ( $product->get_attributes() as $attr ) {
		$slug = strtolower( $attr->get_name() );
		if ( strpos( $slug, 'capacit' ) !== false || strpos( $slug, 'kwh' ) !== false ) {
			$terms = $attr->get_terms();
			if ( $terms ) {
				preg_match( '/[\d.]+/', $terms[0]->name, $m );
				if ( $m ) {
					return (float) $m[0];
				}
			}
		}
	}

	// 3. Uit productnaam extraheren (bv. "5 kWh" of "10kWh")
	preg_match( '/(\d+(?:[.,]\d+)?)\s*kwh/i', $product->get_name(), $m );
	if ( $m ) {
		return (float) str_replace( ',', '.', $m[1] );
	}

	return 0;
}

// ============================================================
// RENDER: volledige configurator (calculator + producten)
// ============================================================

function tb_cfg_render_full( $atts ) {
	$category   = sanitize_text_field( $atts['category'] );
	$product_id = $atts['product_id'] ? absint( $atts['product_id'] ) : 0;
	$show_calc  = ( $atts['show_calc'] !== 'no' );
	?>
	<div class="tb-full-configurator"
	     data-category="<?php echo esc_attr( $category ); ?>"
	     data-product-id="<?php echo esc_attr( $product_id ); ?>">

		<?php if ( $show_calc ) : ?>
		<div class="tb-calc-section">
			<?php tb_cfg_render_calculator(); ?>
		</div>
		<?php endif; ?>

		<div class="tb-products-section" id="tbProductsSection">
			<div class="tb-products-header" id="tbProductsHeader" style="display:none">
				<h2 class="tb-products-title">
					<?php esc_html_e( 'Aanbevolen producten', 'tb-configurator' ); ?>
				</h2>
				<div class="tb-recommend-badge" id="tbRecommendBadge"></div>
			</div>
			<div class="tb-loading" id="tbProductsLoading" style="display:none">
				<div class="tb-spinner"></div>
				<span><?php esc_html_e( 'Producten laden…', 'tb-configurator' ); ?></span>
			</div>
			<div class="tb-products-grid" id="tbProductsGrid"></div>
		</div>

	</div>
	<?php
}

// ============================================================
// RENDER: enkele product configurator (shortcode)
// ============================================================

function tb_cfg_render_product( $product ) {
	$pid        = $product->get_id();
	$is_var     = $product->is_type( 'variable' );
	$image_url  = wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_single' ) ?: wc_placeholder_img_src( 'woocommerce_single' );
	$gallery    = $product->get_gallery_image_ids();
	$variations = $is_var ? $product->get_available_variations() : [];
	?>
	<div class="tb-product-configurator"
	     data-product-id="<?php echo esc_attr( $pid ); ?>"
	     data-type="<?php echo esc_attr( $product->get_type() ); ?>">

		<div class="tb-pc-layout">

			<!-- Galerij -->
			<div class="tb-pc-gallery">
				<div class="tb-gallery-main">
					<img id="tbMainImg-<?php echo $pid; ?>"
					     src="<?php echo esc_url( $image_url ); ?>"
					     alt="<?php echo esc_attr( $product->get_name() ); ?>"
					     class="tb-main-img" />
				</div>
				<?php if ( $gallery ) : ?>
				<div class="tb-gallery-thumbs">
					<div class="tb-thumb tb-thumb-active"
					     data-full="<?php echo esc_url( $image_url ); ?>">
						<img src="<?php echo esc_url( wp_get_attachment_image_url( $product->get_image_id(), 'thumbnail' ) ); ?>" alt="" />
					</div>
					<?php foreach ( $gallery as $gid ) : ?>
					<div class="tb-thumb"
					     data-full="<?php echo esc_url( wp_get_attachment_image_url( $gid, 'woocommerce_single' ) ); ?>">
						<img src="<?php echo esc_url( wp_get_attachment_image_url( $gid, 'thumbnail' ) ); ?>" alt="" />
					</div>
					<?php endforeach; ?>
				</div>
				<?php endif; ?>
			</div>

			<!-- Info en opties -->
			<div class="tb-pc-info">
				<h2 class="tb-pc-name"><?php echo esc_html( $product->get_name() ); ?></h2>

				<?php if ( $product->get_short_description() ) : ?>
				<div class="tb-pc-desc"><?php echo wp_kses_post( $product->get_short_description() ); ?></div>
				<?php endif; ?>

				<div class="tb-pc-price" id="tbPcPrice-<?php echo $pid; ?>">
					<?php echo $product->get_price_html(); // phpcs:ignore ?>
				</div>

				<?php if ( $is_var ) : ?>
				<div class="tb-variation-selector"
				     data-product-id="<?php echo esc_attr( $pid ); ?>"
				     data-variations="<?php echo esc_attr( wp_json_encode( $variations ) ); ?>">

					<?php foreach ( $product->get_variation_attributes() as $attr_name => $options ) :
						$label    = wc_attribute_label( $attr_name, $product );
						$attr_key = 'attribute_' . sanitize_title( $attr_name );
					?>
					<div class="tb-attr-group" data-attr="<?php echo esc_attr( $attr_key ); ?>">
						<div class="tb-attr-label">
							<?php echo esc_html( $label ); ?>:
							<span class="tb-attr-selected"></span>
						</div>
						<div class="tb-btn-group" data-attr="<?php echo esc_attr( $attr_key ); ?>">
							<?php foreach ( $options as $option ) : ?>
							<button type="button" class="tb-opt-btn"
							        data-value="<?php echo esc_attr( $option ); ?>"
							        data-attr="<?php echo esc_attr( $attr_key ); ?>">
								<?php echo esc_html( $option ); ?>
							</button>
							<?php endforeach; ?>
						</div>
					</div>
					<?php endforeach; ?>

					<input type="hidden" class="tb-variation-id" value="" />
					<div class="tb-availability"></div>
				</div>
				<?php endif; ?>

				<!-- Hoeveelheid en winkelwagen -->
				<div class="tb-cart-row">
					<div class="tb-qty-wrap">
						<button type="button" class="tb-qty-btn tb-qty-minus" aria-label="Minder">−</button>
						<input type="number" class="tb-qty-input" value="1" min="1" max="99" aria-label="Aantal" />
						<button type="button" class="tb-qty-btn tb-qty-plus" aria-label="Meer">+</button>
					</div>
					<button type="button"
					        class="tb-add-to-cart tb-btn-primary"
					        data-product-id="<?php echo esc_attr( $pid ); ?>"
					        <?php echo $is_var ? 'disabled' : ''; ?>>
						<?php echo $is_var
							? esc_html__( 'Selecteer opties', 'tb-configurator' )
							: esc_html__( 'In winkelwagen', 'tb-configurator' ); ?>
					</button>
				</div>

				<div class="tb-cart-notice" aria-live="polite" style="display:none"></div>

				<?php if ( $product->get_sku() ) : ?>
				<div class="tb-pc-sku">
					SKU: <span id="tbPcSku-<?php echo $pid; ?>"><?php echo esc_html( $product->get_sku() ); ?></span>
				</div>
				<?php endif; ?>
			</div>
		</div>

	</div>
	<?php
}

// ============================================================
// RENDER: calculator widget
// ============================================================

function tb_cfg_render_calculator() {
	?>
	<div class="tb-calc-wrap">

		<div class="tb-calc-header">
			<div class="tb-calc-brand">
				<div class="tb-calc-logo" aria-hidden="true"></div>
				<div>
					<h2 class="tb-calc-title"><?php esc_html_e( 'Thuisbatterij Configurator', 'tb-configurator' ); ?></h2>
					<div class="tb-calc-sub"><?php esc_html_e( 'Vul je jaarverbruik en -teruglevering in.', 'tb-configurator' ); ?></div>
				</div>
			</div>

			<div class="tb-contract-toggle" id="tbContractToggle"
			     role="switch" aria-checked="false" tabindex="0"
			     title="<?php esc_attr_e( 'Vast of Dynamisch contract', 'tb-configurator' ); ?>">
				<span class="tb-toggle-lbl" id="tbContractLabel"><?php esc_html_e( 'Vast', 'tb-configurator' ); ?></span>
				<div class="tb-toggle-track"><div class="tb-toggle-thumb"></div></div>
				<span class="tb-toggle-lbl"><?php esc_html_e( 'Dynamisch', 'tb-configurator' ); ?></span>
			</div>
		</div>

		<div class="tb-calc-grid">

			<!-- Invoer -->
			<div class="tb-calc-card" id="tbCalcInputCard">
				<div class="tb-section-label"><?php esc_html_e( '1 · Invoer', 'tb-configurator' ); ?></div>

				<div class="tb-form-row">
					<div class="tb-field">
						<label class="tb-lbl" for="tbImportYear"><?php esc_html_e( 'Verbruik uit het net (kWh/jaar)', 'tb-configurator' ); ?></label>
						<input id="tbImportYear" class="tb-input" type="number" min="0" step="1" value="2500" />
						<div class="tb-hint"><?php esc_html_e( 'Totale afname van het net per jaar.', 'tb-configurator' ); ?></div>
					</div>
					<div class="tb-field">
						<label class="tb-lbl" for="tbExportYear"><?php esc_html_e( 'Teruglevering (kWh/jaar)', 'tb-configurator' ); ?></label>
						<input id="tbExportYear" class="tb-input" type="number" min="0" step="1" value="2500" />
						<div class="tb-hint"><?php esc_html_e( 'Hoeveel zonnestroom je teruglevert aan het net.', 'tb-configurator' ); ?></div>
					</div>
				</div>

				<div class="tb-slider-field">
					<label class="tb-lbl" for="tbBatterySlider"><?php esc_html_e( 'Batterijcapaciteit (kWh)', 'tb-configurator' ); ?></label>
					<div class="tb-slider-row">
						<input id="tbBatterySlider" type="range" min="1" max="40" step="0.5" value="5" />
						<input id="tbBatteryNum" class="tb-input tb-input-sm" type="number" min="0" step="0.5" value="5" />
					</div>
					<div class="tb-hint"><?php esc_html_e( 'Gebruik de schuif of "Uitgebreide instellingen".', 'tb-configurator' ); ?></div>
				</div>

				<!-- Uitgebreide instellingen -->
				<div class="tb-advanced-fields" id="tbAdvFields">
					<div class="tb-form-row" style="margin-top:12px">
						<div class="tb-field">
							<label class="tb-lbl" for="tbImportPrice"><?php esc_html_e( 'Stroomprijs (€/kWh)', 'tb-configurator' ); ?></label>
							<input id="tbImportPrice" class="tb-input" type="number" min="0" step="0.01" value="0.30" />
						</div>
						<div class="tb-field">
							<label class="tb-lbl" for="tbExportWithNet"><?php esc_html_e( 'Teruglevertarief met salderen', 'tb-configurator' ); ?></label>
							<input id="tbExportWithNet" class="tb-input" type="number" min="0" step="0.01" value="0.12" />
							<div class="tb-hint"><?php esc_html_e( 'Gem. ~€0,12/kWh', 'tb-configurator' ); ?></div>
						</div>
					</div>
					<div class="tb-form-row" style="margin-top:10px">
						<div class="tb-field">
							<label class="tb-lbl" for="tbExportPostNet"><?php esc_html_e( 'Teruglevertarief na salderen', 'tb-configurator' ); ?></label>
							<input id="tbExportPostNet" class="tb-input" type="number" min="0" step="0.01" value="0.04" />
							<div class="tb-hint"><?php esc_html_e( 'Gem. ~€0,04/kWh', 'tb-configurator' ); ?></div>
						</div>
						<div class="tb-field">
							<label class="tb-lbl"><?php esc_html_e( 'Rendement batterij (round-trip)', 'tb-configurator' ); ?></label>
							<div class="tb-slider-row">
								<input id="tbEfficiency" type="range" min="60" max="98" step="1" value="80" />
								<span id="tbEffLbl" class="tb-suffix">80%</span>
							</div>
						</div>
					</div>
					<div class="tb-form-row" style="margin-top:10px">
						<div class="tb-field">
							<label class="tb-lbl"><?php esc_html_e( 'Max. cycli per dag', 'tb-configurator' ); ?></label>
							<div class="tb-slider-row">
								<input id="tbCycles" type="range" min="0.5" max="1.3" step="0.1" value="1" />
								<span id="tbCyclesLbl" class="tb-suffix">1,0×</span>
							</div>
						</div>
						<div class="tb-field" id="tbSpreadField" style="display:none">
							<label class="tb-lbl" for="tbPriceSpread"><?php esc_html_e( 'Gem. prijsverschil (€/kWh)', 'tb-configurator' ); ?></label>
							<input id="tbPriceSpread" class="tb-input" type="number" min="0" step="0.01" value="0.12" />
							<div class="tb-hint"><?php esc_html_e( 'Alleen relevant bij Dynamisch tarief.', 'tb-configurator' ); ?></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Resultaat -->
			<div class="tb-calc-card" id="tbCalcResultCard">
				<div class="tb-section-label"><?php esc_html_e( '2 · Resultaat', 'tb-configurator' ); ?></div>

				<div class="tb-kpis">
					<div class="tb-kpi">
						<div class="tb-kpi-lbl"><?php esc_html_e( 'Aanbevolen capaciteit', 'tb-configurator' ); ?></div>
						<div class="tb-kpi-val"><span id="tbRecCap">—</span> kWh</div>
					</div>
					<div class="tb-kpi">
						<div class="tb-kpi-lbl"><?php esc_html_e( 'Terugverdientijd (na saldering)', 'tb-configurator' ); ?></div>
						<div class="tb-kpi-val"><span id="tbPayback">—</span> <?php esc_html_e( 'jaar', 'tb-configurator' ); ?></div>
					</div>
					<div class="tb-kpi">
						<div class="tb-kpi-lbl"><?php esc_html_e( 'Besparing/jr', 'tb-configurator' ); ?> <small>(<?php esc_html_e( 'met salderen', 'tb-configurator' ); ?>)</small></div>
						<div class="tb-kpi-val">€ <span id="tbSavingsWithNet">—</span></div>
					</div>
					<div class="tb-kpi">
						<div class="tb-kpi-lbl"><?php esc_html_e( 'Besparing/jr', 'tb-configurator' ); ?> <small>(<?php esc_html_e( 'na saldering', 'tb-configurator' ); ?>)</small></div>
						<div class="tb-kpi-val">€ <span id="tbSavingsNoNet">—</span></div>
					</div>
				</div>

				<div class="tb-calc-msg" id="tbCalcMsg" aria-live="polite"></div>

				<div class="tb-calc-actions">
					<button type="button" class="tb-btn-secondary" id="tbAdvToggle" aria-expanded="false">
						<?php esc_html_e( 'Uitgebreide instellingen', 'tb-configurator' ); ?>
					</button>
					<button type="button" class="tb-btn-secondary" id="tbCalcReset">
						<?php esc_html_e( 'Reset', 'tb-configurator' ); ?>
					</button>
				</div>

				<div class="tb-rec-cta" id="tbRecCta" style="display:none">
					<div class="tb-rec-text"><?php esc_html_e( 'Op basis van jouw situatie bevelen wij aan:', 'tb-configurator' ); ?></div>
					<div class="tb-rec-cap" id="tbRecCapCta"></div>
					<button type="button" class="tb-btn-primary tb-btn-full" id="tbScrollToProducts">
						<?php esc_html_e( 'Bekijk aanbevolen producten →', 'tb-configurator' ); ?>
					</button>
				</div>
			</div>
		</div>
	</div>
	<?php
}
