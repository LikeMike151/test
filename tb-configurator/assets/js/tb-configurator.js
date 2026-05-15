/**
 * TB Configurator — WooCommerce variatie-selector + AJAX winkelwagen
 * Werkt zowel op WC productpagina's als in shortcode-context
 */
(function ($) {
	'use strict';

	$(document).ready(function () {
		initWcProductPage();
		initProductShortcodes();
		initFullConfigurator();
		initProductPageCalcToggle();
	});

	// ============================================================
	// INKLAPBARE CALCULATOR OP PRODUCTPAGINA
	// ============================================================

	function initProductPageCalcToggle() {
		var $toggle = $('#tbProductCalcToggle');
		var $body   = $('#tbProductCalcBody');
		if (!$toggle.length) return;

		$toggle.on('click', function () {
			var isOpen = $body.is(':visible');
			$body.slideToggle(250);
			$toggle.toggleClass('tb-calc-open', !isOpen);
			$toggle.attr('aria-expanded', String(!isOpen));
		});
	}

	// ============================================================
	// 1. WC PRODUCTPAGINA — verbeterde variatie-UI
	// Onze knoppen zijn al gegenereerd door PHP (tb_cfg_variation_dropdown_html).
	// Hier synchroniseren we klik op knop met het verborgen <select>.
	// ============================================================

	function initWcProductPage() {
		var $form = $('form.variations_form');
		if (!$form.length) return;

		// Knopklik → select updaten → WC-events triggeren
		$form.on('click', '.tb-btn-group .tb-opt-btn', function () {
			var $btn     = $(this);
			var $group   = $btn.closest('.tb-btn-group');
			var attrName = $group.data('attr');
			var value    = $btn.data('value');
			var selectId = $btn.data('select-id');

			$group.find('.tb-opt-btn').removeClass('tb-active');
			$btn.addClass('tb-active');

			// Sync het verborgen select-element
			var $select = $form.find('select[id="' + selectId + '"]');
			if ($select.length) {
				$select.val(value).trigger('change');
			}
		});

		// WC heeft een variatie gevonden → update badges
		$form.on('found_variation', function (e, variation) {
			updateWcVariationUi($form, variation);
		});

		$form.on('reset_data', function () {
			$form.find('.tb-opt-btn').removeClass('tb-active');
			$form.find('.tb-wc-availability').remove();
		});

		// Beschikbaarheid per optie bijwerken
		var variationsData = $form.data('product_variations');
		if (variationsData && variationsData.length) {
			$form.on('woocommerce_variation_select_change', function () {
				updateOptionAvailability($form, variationsData);
			});
			updateOptionAvailability($form, variationsData);
		}
	}

	function updateWcVariationUi($form, variation) {
		// Voorraad badge
		$form.find('.tb-wc-availability').remove();
		var $target = $form.find('.single_add_to_cart_button').closest('.woocommerce-variation-add-to-cart');
		var badge   = variation.is_in_stock
			? '<span class="tb-wc-availability in-stock">✓ Op voorraad</span>'
			: '<span class="tb-wc-availability out-stock">✗ Niet op voorraad</span>';
		$form.find('.variations_button').prepend(badge);
	}

	function updateOptionAvailability($form, variationsData) {
		// Huidige selecties lezen
		var selections = {};
		$form.find('select[data-attribute_name]').each(function () {
			selections[$(this).attr('data-attribute_name')] = $(this).val();
		});

		$form.find('.tb-btn-group').each(function () {
			var $group   = $(this);
			var attrName = $group.data('attr'); // bijv. "attribute_pa_capaciteit"

			$group.find('.tb-opt-btn').each(function () {
				var $btn  = $(this);
				var value = $btn.data('value');

				// Testcombinatie: alle huidige + dit attribuut = value
				var test = $.extend({}, selections, { [attrName]: value });

				var available = variationsData.some(function (v) {
					return Object.keys(test).every(function (attr) {
						var varVal = v.attributes[attr] || '';
						return varVal === '' || varVal === test[attr];
					});
				});

				$btn.toggleClass('tb-unavailable', !available);
			});
		});
	}

	// ============================================================
	// 2. SHORTCODE PRODUCT CONFIGURATOR  [tb_product_configurator]
	// ============================================================

	function initProductShortcodes() {
		$('.tb-product-configurator').each(function () {
			initSingleProduct($(this));
		});
	}

	function initSingleProduct($wrap) {
		var pid = $wrap.data('product-id');

		// Galerijminiaturen
		$wrap.on('click', '.tb-thumb', function () {
			var $t = $(this);
			$wrap.find('.tb-thumb').removeClass('tb-thumb-active');
			$t.addClass('tb-thumb-active');
			var $img = $wrap.find('.tb-main-img');
			$img.css('opacity', 0);
			$img.attr('src', $t.data('full'));
			$img.on('load.tbthumb', function () {
				$img.animate({ opacity: 1 }, 150);
				$img.off('load.tbthumb');
			});
		});

		// Hoeveelheidsknopjes
		$wrap.on('click', '.tb-qty-minus', function () {
			var $i = $wrap.find('.tb-qty-input');
			var v  = parseInt($i.val()) || 1;
			if (v > 1) $i.val(v - 1);
		});
		$wrap.on('click', '.tb-qty-plus', function () {
			var $i = $wrap.find('.tb-qty-input');
			var v  = parseInt($i.val()) || 1;
			if (v < 99) $i.val(v + 1);
		});

		// Variatie-knopklik
		$wrap.on('click', '.tb-variation-selector .tb-opt-btn', function () {
			var $btn   = $(this);
			var $group = $btn.closest('.tb-btn-group');
			$group.find('.tb-opt-btn').removeClass('tb-active');
			$btn.addClass('tb-active');

			// Label bijwerken
			$btn.closest('.tb-attr-group').find('.tb-attr-selected').text($btn.data('value'));

			findMatchingVariation($wrap);
		});

		// In winkelwagen
		$wrap.on('click', '.tb-add-to-cart', function () {
			var $btn = $(this);
			if ($btn.prop('disabled')) return;

			var varId = $wrap.find('.tb-variation-id').val();
			var qty   = parseInt($wrap.find('.tb-qty-input').val()) || 1;
			var attrs = {};
			$wrap.find('.tb-variation-selector .tb-opt-btn.tb-active').each(function () {
				attrs[$(this).data('attr')] = $(this).data('value');
			});

			doAddToCart($wrap, pid, varId, qty, attrs, $btn);
		});
	}

	function findMatchingVariation($wrap) {
		var $selector = $wrap.find('.tb-variation-selector');
		var variations = $selector.data('variations') || [];

		// Lees geselecteerde attributen
		var selected = {};
		var totalGroups = $selector.find('.tb-attr-group').length;
		$selector.find('.tb-opt-btn.tb-active').each(function () {
			selected[$(this).data('attr')] = $(this).data('value');
		});

		if (Object.keys(selected).length < totalGroups) {
			$wrap.find('.tb-add-to-cart').prop('disabled', true).text(tbCfg.i18n.selectOptions);
			return;
		}

		var match = variations.find(function (v) {
			return Object.keys(selected).every(function (attr) {
				var varVal = v.attributes[attr] || '';
				return varVal === '' || varVal === selected[attr];
			});
		});

		var $btn        = $wrap.find('.tb-add-to-cart');
		var $price      = $wrap.find('.tb-pc-price');
		var $avail      = $wrap.find('.tb-availability');
		var $varIdInput = $wrap.find('.tb-variation-id');

		if (match) {
			$varIdInput.val(match.variation_id);
			if (match.price_html) {
				$price.addClass('tb-updating');
				setTimeout(function () {
					$price.html(match.price_html).removeClass('tb-updating');
				}, 80);
			}
			if (match.image) {
				var $mainImg = $wrap.find('.tb-main-img');
				$mainImg.animate({ opacity: 0 }, 100, function () {
					$mainImg.attr('src', match.image).animate({ opacity: 1 }, 150);
				});
			}
			if (match.sku) {
				$wrap.find('[id^="tbPcSku-"]').text(match.sku);
			}
			if (match.in_stock) {
				$btn.prop('disabled', false).text(tbCfg.i18n.addToCart);
				$avail.removeClass('out-stock').addClass('in-stock').text('✓ Op voorraad');
			} else {
				$btn.prop('disabled', true).text(tbCfg.i18n.outOfStock);
				$avail.removeClass('in-stock').addClass('out-stock').text('✗ Niet op voorraad');
			}
		} else {
			$varIdInput.val('');
			$btn.prop('disabled', true).text(tbCfg.i18n.selectOptions);
			$avail.removeClass('in-stock out-stock').text('');
		}
	}

	// ============================================================
	// 3. VOLLEDIGE CONFIGURATOR  [tb_battery_configurator]
	// ============================================================

	function initFullConfigurator() {
		var $wrap = $('.tb-full-configurator');
		if (!$wrap.length) return;

		var category  = $wrap.data('category');
		var productId = $wrap.data('product-id');

		// Producten laden
		loadProducts($wrap, category, productId ? [productId] : []);

		// Calculatorupdate → aanbeveling markeren
		$(document).on('tb:calcUpdate', function (e) {
			if (e.originalEvent && e.originalEvent.detail) {
				highlightRecommended($wrap, e.originalEvent.detail.capacityKwh);
			}
		});

		// Vanilla event doorsturen naar jQuery
		document.addEventListener('tb:calcUpdate', function (e) {
			$(document).trigger($.Event('tb:calcUpdate', { originalEvent: e }));
		});
	}

	function loadProducts($wrap, category, productIds) {
		var $loading = $wrap.find('#tbProductsLoading');
		$loading.show();

		$.ajax({
			url:    tbCfg.ajaxUrl,
			method: 'POST',
			data: {
				action:      'tb_get_products',
				nonce:       tbCfg.nonce,
				category:    category,
				product_ids: productIds || [],
			},
			success: function (res) {
				$loading.hide();
				if (res.success && res.data.products && res.data.products.length) {
					renderProducts($wrap, res.data.products);
					$wrap.find('#tbProductsHeader').show();
				}
			},
			error: function () {
				$loading.hide();
			},
		});
	}

	function renderProducts($wrap, products) {
		var $grid = $wrap.find('#tbProductsGrid');
		$grid.empty();

		products.forEach(function (p) {
			var $card = buildProductCard(p);
			$grid.append($card);

			// Variaties laden voor variabele producten
			if (p.type === 'variable') {
				loadVariationsForCard($wrap, p.id, $card);
			}
		});
	}

	function buildProductCard(p) {
		var attrsHtml = '';
		if (p.type === 'variable' && p.attributes && p.attributes.length) {
			attrsHtml += '<div class="tb-card-variations">';
			p.attributes.forEach(function (attr) {
				attrsHtml += '<div class="tb-attr-group" data-attr="' + escAttr(attr.name) + '">';
				attrsHtml += '<div class="tb-attr-label">' + escHtml(attr.label) + ':</div>';
				attrsHtml += '<div class="tb-btn-group" data-attr="' + escAttr(attr.name) + '">';
				attr.options.forEach(function (opt) {
					attrsHtml += '<button type="button" class="tb-opt-btn" data-value="' + escAttr(opt) + '" data-attr="' + escAttr(attr.name) + '">' + escHtml(opt) + '</button>';
				});
				attrsHtml += '</div></div>';
			});
			attrsHtml += '</div>';
		}

		var btnText  = p.type === 'variable' ? tbCfg.i18n.selectOptions : tbCfg.i18n.addToCart;
		var btnExtra = p.type === 'variable' ? ' disabled' : '';

		var html = '<div class="tb-product-card" data-product-id="' + p.id + '" data-capacity="' + (p.capacity_kwh || 0) + '">'
			+ '<div class="tb-card-img"><img src="' + escAttr(p.image) + '" alt="' + escAttr(p.name) + '" loading="lazy" /></div>'
			+ '<div class="tb-card-body">'
			+   '<h3 class="tb-card-name">' + escHtml(p.name) + '</h3>'
			+   (p.short_desc ? '<div class="tb-card-desc">' + escHtml(p.short_desc) + '</div>' : '')
			+   '<div class="tb-card-price">' + p.price_html + '</div>'
			+   attrsHtml
			+   '<div class="tb-card-actions">'
			+     '<button type="button" class="tb-btn-primary tb-add-to-cart" data-product-id="' + p.id + '"' + btnExtra + '>' + btnText + '</button>'
			+     '<div class="tb-card-notice" style="display:none"></div>'
			+   '</div>'
			+ '</div>'
			+ '</div>';

		var $card = $(html);

		// Variatie-knopklik in kaart
		$card.on('click', '.tb-opt-btn', function () {
			var $btn   = $(this);
			var $group = $btn.closest('.tb-btn-group');
			$group.find('.tb-opt-btn').removeClass('tb-active');
			$btn.addClass('tb-active');
			matchCardVariation($card, p);
		});

		// Winkelwagen vanuit kaart
		$card.on('click', '.tb-add-to-cart', function () {
			var $btn  = $(this);
			if ($btn.prop('disabled')) return;
			var varId = $card.data('selected-var') || 0;
			var attrs = {};
			$card.find('.tb-opt-btn.tb-active').each(function () {
				attrs[$(this).data('attr')] = $(this).data('value');
			});
			doAddToCart($card, p.id, varId, 1, attrs, $btn);
		});

		return $card;
	}

	function loadVariationsForCard($wrap, productId, $card) {
		$.ajax({
			url:    tbCfg.ajaxUrl,
			method: 'POST',
			data: {
				action:     'tb_get_variations',
				nonce:      tbCfg.nonce,
				product_id: productId,
			},
			success: function (res) {
				if (res.success) {
					$card.data('variations', res.data.variations);
				}
			},
		});
	}

	function matchCardVariation($card, product) {
		var variations = $card.data('variations');
		if (!variations) return;

		var selected    = {};
		var totalGroups = $card.find('.tb-attr-group').length;
		$card.find('.tb-opt-btn.tb-active').each(function () {
			selected[$(this).data('attr')] = $(this).data('value');
		});

		if (Object.keys(selected).length < totalGroups) return;

		var match = variations.find(function (v) {
			return Object.keys(selected).every(function (attr) {
				var varVal = v.attributes[attr] || '';
				return varVal === '' || varVal === selected[attr];
			});
		});

		var $btn = $card.find('.tb-add-to-cart');

		if (match) {
			$card.data('selected-var', match.id);
			if (match.price_html) $card.find('.tb-card-price').html(match.price_html);
			if (match.image)      $card.find('.tb-card-img img').attr('src', match.image);

			if (match.in_stock) {
				$btn.prop('disabled', false).text(tbCfg.i18n.addToCart);
			} else {
				$btn.prop('disabled', true).text(tbCfg.i18n.outOfStock);
			}
		} else {
			$card.data('selected-var', null);
			$btn.prop('disabled', true).text(tbCfg.i18n.selectOptions);
		}
	}

	function highlightRecommended($wrap, capacityKwh) {
		if (!capacityKwh || capacityKwh <= 0) return;

		var best     = null;
		var bestDiff = Infinity;

		$wrap.find('.tb-product-card').each(function () {
			var cap  = parseFloat($(this).data('capacity')) || 0;
			if (cap > 0) {
				var diff = Math.abs(cap - capacityKwh);
				if (diff < bestDiff) { bestDiff = diff; best = $(this); }
			}
		});

		$wrap.find('.tb-product-card').removeClass('tb-recommended');

		if (best) {
			best.addClass('tb-recommended');
			var badge = $wrap.find('#tbRecommendBadge');
			badge.text(capacityKwh.toLocaleString('nl-NL') + ' kWh aanbevolen');
		}
	}

	// ============================================================
	// AJAX: in winkelwagen
	// ============================================================

	function doAddToCart($context, productId, variationId, qty, attrs, $btn) {
		var original = $btn.text();
		$btn.prop('disabled', true).text(tbCfg.i18n.adding);

		$.ajax({
			url:    tbCfg.ajaxUrl,
			method: 'POST',
			data: {
				action:       'tb_add_to_cart',
				nonce:        tbCfg.nonce,
				product_id:   productId,
				variation_id: variationId || 0,
				quantity:     qty,
				variation:    attrs,
			},
			success: function (res) {
				if (res.success) {
					$btn.text(tbCfg.i18n.added).addClass('tb-added');
					showCartNotice($context, res.data.message, 'success');

					// Winkelwagen teller bijwerken
					$('.cart-contents-count, .woocommerce-cart-menu-item .count').text(res.data.cart_count);
					$(document.body).trigger('wc_fragment_refresh');

					setTimeout(function () {
						$btn.text(tbCfg.i18n.addToCart).removeClass('tb-added').prop('disabled', false);
					}, 3000);
				} else {
					$btn.text(original).prop('disabled', false);
					showCartNotice($context, res.data.message, 'error');
				}
			},
			error: function () {
				$btn.text(original).prop('disabled', false);
				showCartNotice($context, 'Er ging iets mis. Probeer het opnieuw.', 'error');
			},
		});
	}

	function showCartNotice($context, msg, type) {
		var $notice = $context.find('.tb-cart-notice').first();
		if (!$notice.length) return;
		$notice
			.removeClass('success error')
			.addClass(type)
			.text(msg)
			.show();
		setTimeout(function () { $notice.fadeOut(300); }, 4000);
	}

	// ============================================================
	// Utils
	// ============================================================

	function escHtml(str) {
		return $('<div>').text(str || '').html();
	}

	function escAttr(str) {
		return (str || '').toString()
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

})(jQuery);
