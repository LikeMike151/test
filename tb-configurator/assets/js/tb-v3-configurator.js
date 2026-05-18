/**
 * TB Configurator v3 — Product configurator logic
 * Geen externe dependencies behalve jQuery (aanwezig in WordPress).
 */
(function ($) {
	'use strict';

	// tbV3Data is injected by PHP via wp_add_inline_script:
	// { productId, variations, attributes, upsells, stackCfg }

	if (typeof tbV3Data === 'undefined') return;

	// ============================================================
	// STATE
	// ============================================================

	var state = {
		selected: {},    // attribute_key -> variation-slug value
		upsells:  {},    // group_key -> { product_id, price, label }
		variationId: null,
		variationPrice: null,
	};

	// Pre-populate upsell state: default = "geen" (product_id 0)
	$.each(tbV3Data.upsells || {}, function (gk) {
		state.upsells[gk] = { product_id: 0, price: 0, label: '' };
	});

	// ============================================================
	// INIT
	// ============================================================

	$(document).ready(function () {
		if (!$('.tb-v3-configurator').length) return;

		bindOptionButtons();
		bindUpsellButtons();
		bindCta();
		applyDefaults();
		updateAll();
	});

	// Pre-select WC default attributes so price shows on page load
	function applyDefaults() {
		var defaults = tbV3Data.defaults || {};
		$.each(defaults, function (attrName, value) {
			if (!value) return;
			var attrKey = 'attribute_' + attrName;
			state.selected[attrKey] = value;
			$('.tb-v3-step[data-attr="' + attrKey + '"] .tb-v3-opt').removeClass('tb-v3-opt-active');
			$('.tb-v3-step[data-attr="' + attrKey + '"] .tb-v3-opt[data-value="' + value + '"]').addClass('tb-v3-opt-active');
		});
	}

	// ============================================================
	// BINDINGS
	// ============================================================

	function bindOptionButtons() {
		$(document).on('click', '.tb-v3-step .tb-v3-opt', function () {
			var $btn  = $(this);
			var attr  = $btn.data('attr');
			var value = $btn.data('value');

			if ($btn.hasClass('tb-v3-opt-disabled')) return;

			// Deselect siblings, select this
			$btn.closest('.tb-v3-options').find('.tb-v3-opt').removeClass('tb-v3-opt-active');
			$btn.addClass('tb-v3-opt-active');

			// Update state
			state.selected[attr] = value;

			// Sync hidden WC select (for any WC scripts listening)
			$('.tb-v3-hidden-select[data-attribute_name="' + attr + '"]').val(value).trigger('change');

			updateAll();
		});
	}

	function bindUpsellButtons() {
		$(document).on('click', '.tb-v3-upsell .tb-v3-opt', function () {
			var $btn      = $(this);
			var group     = $btn.data('group');
			var productId = parseInt($btn.data('product-id')) || 0;
			var price     = parseFloat($btn.data('price')) || 0;
			var label     = $btn.find('.tb-v3-opt-price').length
				? $btn.clone().find('.tb-v3-opt-price').remove().end().text().trim()
				: $btn.text().trim();

			$btn.closest('.tb-v3-options').find('.tb-v3-opt').removeClass('tb-v3-opt-active');
			$btn.addClass('tb-v3-opt-active');

			state.upsells[group] = { product_id: productId, price: price, label: label };
			updateAll();
		});
	}

	function bindCta() {
		$(document).on('click', '#tbCta', function () {
			if (!state.variationId) return;
			doAddToCart();
		});
	}

	// ============================================================
	// UPDATE LOOP — called after every state change
	// ============================================================

	function updateAll() {
		matchVariation();
		updateAvailability();
		updateStack();
		updateCartPreview();
		updateCta();
		updateMainImage();
	}

	// ============================================================
	// VARIATION MATCHING
	// ============================================================

	function matchVariation() {
		state.variationId    = null;
		state.variationPrice = null;

		var variations = tbV3Data.variations || [];
		var selected   = state.selected;

		// Check all attributes have a selection
		var attrs = tbV3Data.attributes || [];
		for (var i = 0; i < attrs.length; i++) {
			if (!selected[attrs[i].key]) return; // incomplete
		}

		// Find matching variation
		for (var v = 0; v < variations.length; v++) {
			var variation = variations[v];
			var match = true;

			$.each(variation.attributes, function (attrKey, attrVal) {
				// Empty attrVal means "any" in WC
				if (attrVal !== '' && attrVal !== selected[attrKey]) {
					match = false;
					return false; // break
				}
			});

			if (match && variation.in_stock) {
				state.variationId    = variation.id;
				state.variationPrice = variation.price;
				$('#tbVariationId').val(variation.id);
				return;
			}
		}

		// No match or out of stock
		$('#tbVariationId').val('');
	}

	// ============================================================
	// AVAILABILITY: disable incompatible options
	// ============================================================

	function updateAvailability() {
		var variations = tbV3Data.variations || [];
		var attrs      = tbV3Data.attributes || [];

		attrs.forEach(function (attr) {
			$('.tb-v3-step[data-attr="' + attr.key + '"] .tb-v3-opt').each(function () {
				var $btn  = $(this);
				var value = $btn.data('value');

				// Build test selection: current state + this button's value
				var testSel = $.extend({}, state.selected, {});
				testSel[attr.key] = value;

				var available = variations.some(function (v) {
					if (!v.in_stock) return false;
					return attrs.every(function (a) {
						var varVal = v.attributes[a.key] || '';
						var selVal = testSel[a.key] || '';
						return varVal === '' || selVal === '' || varVal === selVal;
					});
				});

				$btn.toggleClass('tb-v3-opt-disabled', !available);
				$btn.prop('disabled', !available);
			});
		});
	}

	// ============================================================
	// VISUAL STACK
	// ============================================================

	function updateStack() {
		var cfg = tbV3Data.stackCfg;
		if (!cfg || !cfg.enabled) return;

		var $blocks = $('#tbStackBlocks');
		$blocks.empty();

		var capAttr   = cfg.capacity_attr;
		var invAttr   = cfg.inverter_attr;
		var capValue  = capAttr ? (state.selected[capAttr] || '') : '';
		var invValue  = invAttr ? (state.selected[invAttr] || '') : '';

		// Determine if inverter is selected (and not "alleen batterij")
		// Check against the human-readable label, not the slug, because slugs use dashes not spaces
		var invLabel = invAttr ? getAttrLabel(invAttr, invValue) : '';
		var showInverter = invAttr && invValue && !isOnlyBattery(invLabel);

		// Parse capacity label for PFA4 / PFA2 counts
		var capLabel = capAttr ? getAttrLabel(capAttr, capValue) : capValue;
		var parsed = parseCapacityLabel(capLabel);

		// Render inverter block
		if (showInverter) {
			$blocks.append(
				$('<div class="tb-stack-block-inverter">').text(invLabel.substring(0, 18))
			);
		}

		// Render PFA4 blocks
		for (var i = 0; i < parsed.pfa4; i++) {
			$blocks.append($('<div class="tb-stack-block-pfa4">').text('PFA4  4 kWh'));
		}

		// Render PFA2 block
		if (parsed.pfa2) {
			$blocks.append($('<div class="tb-stack-block-pfa2">').text('PFA2  2 kWh'));
		}

		// Generic fallback: show kWh blocks if no PFA structure
		if (parsed.pfa4 === 0 && !parsed.pfa2 && parsed.kwh > 0) {
			var blocks = Math.min(Math.round(parsed.kwh / 4), 6);
			for (var b = 0; b < blocks; b++) {
				$blocks.append($('<div class="tb-stack-block-generic">').text(parsed.kwh / blocks + ' kWh'));
			}
		}

		// kWh total label
		var kwh = parsed.kwh || 0;
		// Add base inverter kWh if inverter selected (Eco/hybride = 2 kWh base)
		if (showInverter) {
			kwh += 2;
		}
		$('#tbStackKwh').text(kwh > 0 ? kwh + ' kWh' : '0 kWh');

		// Slot counter
		var totalBat = parsed.pfa4 + (parsed.pfa2 ? 1 : 0);
		$('#tbStackSlots').text(totalBat > 0 ? totalBat + '/5 batterijen' : '');
	}

	function isOnlyBattery(value) {
		// Detect "Ik heb al een omvormer" type selections
		return /al een|alleen batterij|only battery/i.test(value);
	}

	function parseCapacityLabel(label) {
		// Parse labels like:
		// "Geen extra batterij" -> 0 kWh
		// "1× PFA4 (4 kWh)" -> pfa4:1, pfa2:0, kwh:4
		// "2× PFA4 + 1× PFA2 (10 kWh)" -> pfa4:2, pfa2:1, kwh:10
		// "5× PFA4 (20 kWh)" -> pfa4:5, pfa2:0, kwh:20
		var result = { pfa4: 0, pfa2: false, kwh: 0 };

		if (!label || /geen|no extra/i.test(label)) return result;

		// PFA4 count
		var pfa4Match = label.match(/(\d+)[×x]\s*PFA4/i);
		if (pfa4Match) result.pfa4 = parseInt(pfa4Match[1]);

		// PFA2 toggle
		result.pfa2 = /PFA2/i.test(label);

		// Total kWh — first try parentheses format "(20 kWh)", then bare "20 kWh"
		var kwhMatch = label.match(/\((\d+)\s*kWh\)/i) || label.match(/\b(\d+)\s*kWh\b/i);
		if (kwhMatch) {
			result.kwh = parseInt(kwhMatch[1]);
		} else {
			result.kwh = (result.pfa4 * 4) + (result.pfa2 ? 2 : 0);
		}

		return result;
	}

	function getAttrLabel(attrKey, value) {
		var attrs = tbV3Data.attributes || [];
		for (var i = 0; i < attrs.length; i++) {
			if (attrs[i].key === attrKey && attrs[i].labels && attrs[i].labels[value]) {
				return attrs[i].labels[value];
			}
		}
		return value;
	}

	// ============================================================
	// CART PREVIEW
	// ============================================================

	function updateCartPreview() {
		var mainPrice   = state.variationPrice;
		var upsellTotal = 0;
		var $upsells    = $('#tbCartUpsells');

		$upsells.empty();

		// Upsell rows
		var hasUpsell = false;
		$.each(state.upsells, function (gk, u) {
			if (u.product_id > 0 && u.price > 0) {
				upsellTotal += u.price;
				hasUpsell = true;
			}
		});

		if (hasUpsell) {
			$upsells.append('<div class="tb-v3-cart-upsell-label">+ Extra los product</div>');
			$.each(state.upsells, function (gk, u) {
				if (u.product_id > 0) {
					$upsells.append(
						'<div class="tb-v3-cart-upsell-row">' +
						'<span class="tb-v3-cart-name">' + escHtml(u.label) + '</span>' +
						'<span class="tb-v3-cart-price">' + formatPrice(u.price) + '</span>' +
						'</div>'
					);
				}
			});
		}

		// Main price
		if (mainPrice !== null) {
			$('#tbCartMainPrice').text(formatPrice(mainPrice));
			var total = mainPrice + upsellTotal;
			$('#tbCartTotal').text(formatPrice(total));
		} else {
			$('#tbCartMainPrice').text('—');
			$('#tbCartTotal').text('—');
		}
	}

	// ============================================================
	// CTA STATE
	// ============================================================

	function updateCta() {
		var $cta    = $('#tbCta');
		var ready   = !!state.variationId;
		var upsells = countUpsellProducts();

		$cta.prop('disabled', !ready);

		if (ready) {
			var label = upsells > 0
				? 'Deze thuisbatterij bestellen » (' + (1 + upsells) + ' producten)'
				: 'Deze thuisbatterij bestellen »';
			$cta.text(label);
		} else {
			$cta.text('Maak eerst een keuze bij alle stappen');
		}
	}

	function countUpsellProducts() {
		var count = 0;
		$.each(state.upsells, function (gk, u) {
			if (u.product_id > 0) count++;
		});
		return count;
	}

	// ============================================================
	// PRODUCT AFBEELDING UPDATEN
	// ============================================================

	function updateMainImage() {
		if (!state.variationId) return;
		var variation = tbV3Data.variations.find(function (v) {
			return v.id === state.variationId;
		});
		if (variation && variation.image) {
			// Update the stack thumbnail (our left column)
			$('#tbProductThumb').attr('src', variation.image);
			// Also update the main WC gallery image if visible
			$('.woocommerce-product-gallery__image img').first().attr('src', variation.image);
		}
	}

	// ============================================================
	// ADD TO CART
	// ============================================================

	function doAddToCart() {
		var $cta = $('#tbCta');
		$cta.prop('disabled', true).text(tbCfg.i18n.ordering);
		$('#tbCtaNotice').text('').removeClass('tb-error');

		var items = [];

		// Item 1: hoofdvariatie
		var variation = {};
		$.each(state.selected, function (k, v) {
			variation[k] = v;
		});

		items.push({
			product_id:   tbV3Data.productId,
			variation_id: state.variationId,
			quantity:     1,
			variation:    variation,
		});

		// Item 2+: upsell-producten
		$.each(state.upsells, function (gk, u) {
			if (u.product_id > 0) {
				items.push({
					product_id:   u.product_id,
					variation_id: 0,
					quantity:     1,
				});
			}
		});

		$.ajax({
			url:    tbCfg.ajaxUrl,
			method: 'POST',
			data: {
				action: 'tb_multi_add_to_cart',
				nonce:  tbCfg.nonce,
				items:  items,
			},
			success: function (res) {
				if (res.success) {
					// Redirect to cart
					window.location.href = tbCfg.cartUrl;
				} else {
					showCtaError(res.data.message || 'Er ging iets mis.');
					$cta.prop('disabled', false);
					updateCta();
				}
			},
			error: function () {
				showCtaError('Verbindingsfout. Probeer het opnieuw.');
				$cta.prop('disabled', false);
				updateCta();
			},
		});
	}

	function showCtaError(msg) {
		$('#tbCtaNotice').text(msg).addClass('tb-error');
	}

	// ============================================================
	// UTILS
	// ============================================================

	function formatPrice(amount) {
		if (amount === null || amount === undefined) return '—';
		return '€ ' + parseFloat(amount).toLocaleString('nl-NL', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	function escHtml(str) {
		return $('<div>').text(str || '').html();
	}

})(jQuery);
