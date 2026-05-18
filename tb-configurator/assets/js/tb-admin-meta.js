/**
 * TB Configurator — Admin meta box JS
 * Beheert de upsell-groepen repeater in het WooCommerce product-edit scherm.
 */
(function ($) {
	'use strict';

	$(document).ready(function () {
		if (!$('#tbUpsellGroups').length) return;

		// Serialize state to hidden JSON field before form submit
		$('form#post').on('submit', serializeUpsells);

		// Add group
		$('#tbAddGroup').on('click', function () {
			var gk = 'group_' + Date.now();
			addGroup(gk, { label: '', none_label: '', options: [] });
		});

		// Delegated: remove group
		$(document).on('click', '.tb-remove-group', function () {
			$(this).closest('.tb-upsell-group').remove();
			serializeUpsells();
		});

		// Delegated: add option row
		$(document).on('click', '.tb-add-option', function () {
			$(this).before(buildOptionRow({ product_id: '', label: '', price: '' }));
		});

		// Delegated: remove option row
		$(document).on('click', '.tb-remove-option', function () {
			$(this).closest('.tb-upsell-option').remove();
			serializeUpsells();
		});

		// Serialize on any input change
		$(document).on('change input', '#tbUpsellGroups input, #tbUpsellGroups select', function () {
			serializeUpsells();
		});
	});

	function addGroup(gk, group) {
		var $wrap = $('<div class="tb-upsell-group" data-group-key="' + escAttr(gk) + '">');

		var $header = $('<div class="tb-upsell-group-header">');
		$header.append('<strong>Groep:</strong> ');
		$header.append($('<input type="text" class="tb-group-label">').val(group.label || '').attr('placeholder', 'bijv. Meter'));
		$header.append(' &nbsp; <strong>Sla-over tekst:</strong> ');
		$header.append($('<input type="text" class="tb-group-none">').val(group.none_label || '').attr('placeholder', 'bijv. Ik heb er al een'));
		$header.append($('<button type="button" class="button button-small button-remove tb-remove-group">Verwijder groep</button>'));

		var $colHeaders = $('<div style="display:grid;grid-template-columns:1fr 1fr 120px 30px;gap:6px;margin-bottom:4px;font-size:11px;font-weight:700;color:#666">');
		$colHeaders.append('<span>Product ID</span><span>Label</span><span>Prijs (€)</span><span></span>');

		var $options = $('<div class="tb-upsell-options">');
		(group.options || []).forEach(function (opt) {
			$options.append(buildOptionRow(opt));
		});

		var $addBtn = $('<button type="button" class="button tb-btn-small tb-add-option">+ Optie toevoegen</button>');

		$wrap.append($header).append($colHeaders).append($options).append($addBtn);
		$('#tbUpsellGroups').append($wrap);

		serializeUpsells();
	}

	function buildOptionRow(opt) {
		var $row = $('<div class="tb-upsell-option">');
		$row.append($('<input type="number" class="tb-opt-pid">').val(opt.product_id || '').attr('placeholder', 'Product ID'));
		$row.append($('<input type="text" class="tb-opt-label">').val(opt.label || '').attr('placeholder', 'Label'));
		$row.append($('<input type="number" class="tb-opt-price" step="0.01">').val(opt.price || '').attr('placeholder', '0.00'));
		$row.append($('<button type="button" class="button button-small button-remove tb-remove-option">✕</button>'));
		return $row;
	}

	function serializeUpsells() {
		var result = {};

		$('#tbUpsellGroups .tb-upsell-group').each(function () {
			var $group = $(this);
			var gk     = $group.data('group-key') || ('group_' + Date.now());
			var label  = $group.find('.tb-group-label').val().trim();
			var none   = $group.find('.tb-group-none').val().trim();
			var opts   = [];

			$group.find('.tb-upsell-option').each(function () {
				var pid   = parseInt($(this).find('.tb-opt-pid').val()) || 0;
				var lbl   = $(this).find('.tb-opt-label').val().trim();
				var price = parseFloat($(this).find('.tb-opt-price').val()) || 0;
				if (pid > 0 || lbl) {
					opts.push({ product_id: pid, label: lbl, price: price });
				}
			});

			result[gk] = { label: label, none_label: none, options: opts };
		});

		$('#tbUpsellsJson').val(JSON.stringify(result));
	}

	function escAttr(str) {
		return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

})(jQuery);
