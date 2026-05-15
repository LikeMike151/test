/**
 * TB Battery Calculator
 * Besparingsberekening voor thuisbatterij — aangepast voor WordPress plugin
 */
(function () {
	'use strict';

	// Wacht tot DOM klaar is
	document.addEventListener('DOMContentLoaded', function () {
		if (!document.getElementById('tbImportYear')) return;
		initCalc();
	});

	function initCalc() {
		var el = {
			importYear:     id('tbImportYear'),
			exportYear:     id('tbExportYear'),
			importPrice:    id('tbImportPrice'),
			exportWithNet:  id('tbExportWithNet'),
			exportPostNet:  id('tbExportPostNet'),
			efficiency:     id('tbEfficiency'),
			effLbl:         id('tbEffLbl'),
			cycles:         id('tbCycles'),
			cyclesLbl:      id('tbCyclesLbl'),
			batterySlider:  id('tbBatterySlider'),
			batteryNum:     id('tbBatteryNum'),
			contractToggle: id('tbContractToggle'),
			contractLabel:  id('tbContractLabel'),
			spreadField:    id('tbSpreadField'),
			priceSpread:    id('tbPriceSpread'),
			advToggle:      id('tbAdvToggle'),
			advFields:      id('tbAdvFields'),
			resetBtn:       id('tbCalcReset'),
			// Outputs
			recCap:         id('tbRecCap'),
			savingsWithNet: id('tbSavingsWithNet'),
			savingsNoNet:   id('tbSavingsNoNet'),
			payback:        id('tbPayback'),
			calcMsg:        id('tbCalcMsg'),
			recCta:         id('tbRecCta'),
			recCapCta:      id('tbRecCapCta'),
			scrollBtn:      id('tbScrollToProducts'),
		};

		var userTouchedCycles = false;

		// ── Helpers ────────────────────────────────────────────

		function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
		function roundHalf(v)   { return Math.round(v * 2) / 2; }

		// Getrapte marginale capex
		function calcCapex(C) {
			var remaining = Math.max(0, C);
			var capex = 0;
			var tiers = [
				{ size: 5,  price: 350 },
				{ size: 5,  price: 340 },
				{ size: 5,  price: 330 },
				{ size: 25, price: 320 },
			];
			for (var i = 0; i < tiers.length; i++) {
				if (remaining <= 0) break;
				var take = Math.min(remaining, tiers[i].size);
				capex += take * tiers[i].price;
				remaining -= take;
			}
			return capex;
		}

		function isDynamic() {
			return el.contractToggle && el.contractToggle.classList.contains('tb-on');
		}

		function setDynamic(on) {
			if (!el.contractToggle) return;
			el.contractToggle.classList.toggle('tb-on', on);
			el.contractToggle.setAttribute('aria-checked', String(on));
			if (el.spreadField) el.spreadField.style.display = on ? '' : 'none';
		}

		function readInputs() {
			return {
				importYear:    Math.max(0, num(el.importYear, 2500)),
				exportYear:    Math.max(0, num(el.exportYear, 2500)),
				importPrice:   Math.max(0, num(el.importPrice, 0.30)),
				exportWithNet: Math.max(0, num(el.exportWithNet, 0.12)),
				exportPostNet: Math.max(0, num(el.exportPostNet, 0.04)),
				eta:           clamp(num(el.efficiency, 80) / 100, 0.5, 0.99),
				cycles:        clamp(num(el.cycles, 1.0), 0.1, 3),
				C:             Math.max(0, num(el.batterySlider, 5)),
				dynamic:       isDynamic(),
				spread:        Math.max(0, num(el.priceSpread, 0.12)),
			};
		}

		function num(input, fallback) {
			if (!input) return fallback;
			var v = parseFloat(input.value);
			return isNaN(v) ? fallback : v;
		}

		function recommendCapacity(importYear, exportYear) {
			var I = importYear / 365;
			var E = exportYear / 365;
			if (!isFinite(I) || !isFinite(E) || (I === 0 && E === 0)) return 0;
			return clamp(roundHalf(Math.min(I, E)), 1, 40);
		}

		function applyRecommended() {
			var r = readInputs();
			var rec = recommendCapacity(r.importYear, r.exportYear);
			if (el.batterySlider) el.batterySlider.value = rec;
			if (el.batteryNum)   el.batteryNum.value    = rec.toFixed(1);
		}

		// ── Berekening ──────────────────────────────────────────

		function compute() {
			var r = readInputs();

			var I     = r.importYear / 365;
			var E     = r.exportYear / 365;
			var base  = Math.min(I, E);
			var Cd    = r.C * r.cycles;

			// PV-shift
			var pvShift    = Math.min(Cd, base);
			var pvDisch    = Math.min(pvShift, I) * r.eta;

			// Arbitrage (dynamisch tarief)
			var arbShift = 0;
			if (r.dynamic) {
				var extra     = Math.min(I, base * 0.30);
				var remaining = Math.max(0, Cd - pvShift);
				arbShift      = Math.min(remaining, extra);
			}
			var arbDisch = arbShift * r.eta;

			var exportReduction = pvShift * 365;
			var pvAnnual        = pvDisch * 365;

			var savingsPV_with = pvAnnual * r.importPrice - exportReduction * r.exportWithNet;
			var savingsPV_no   = pvAnnual * r.importPrice - exportReduction * r.exportPostNet;
			var savingsArb     = (arbDisch * 365) * r.spread;

			var savingsWith = savingsPV_with + savingsArb;
			var savingsNo   = savingsPV_no   + savingsArb;

			var capex   = calcCapex(r.C);
			var payback = savingsNo > 0 ? capex / savingsNo : Infinity;

			// Schrijf naar UI
			setText(el.savingsWithNet, Math.round(savingsWith).toLocaleString('nl-NL'));
			setText(el.savingsNoNet,   Math.round(savingsNo).toLocaleString('nl-NL'));
			setText(el.payback,        isFinite(payback) ? payback.toFixed(1) : '—');

			var rec = recommendCapacity(r.importYear, r.exportYear);
			setText(el.recCap, rec.toLocaleString('nl-NL'));

			// Bericht
			var msg = '';
			if (r.exportYear < 1) msg += 'Je geeft 0 kWh terug: PV-shift is beperkt. ';
			if (r.importYear < 1) msg += 'Je besparing is laag bij 0 kWh afname. ';
			msg += r.dynamic
				? 'Met dynamische tarieven kan de batterij ook 's nachts goedkoop opladen.'
				: 'Besparing berekend bij een vast of variabel contract.';
			setText(el.calcMsg, msg);

			// Aanbeveling CTA tonen/bijwerken
			if (el.recCta) {
				if (rec > 0) {
					el.recCta.style.display = '';
					setText(el.recCapCta, rec.toLocaleString('nl-NL') + ' kWh');
				} else {
					el.recCta.style.display = 'none';
				}
			}

			// Stuur event naar configurator JS
			var event = new CustomEvent('tb:calcUpdate', {
				bubbles: true,
				detail: {
					capacityKwh:  rec,
					savingsWith:  Math.round(savingsWith),
					savingsNo:    Math.round(savingsNo),
					payback:      isFinite(payback) ? payback : null,
				},
			});
			document.dispatchEvent(event);
		}

		function setText(el, val) {
			if (el) el.textContent = val;
		}

		// ── Event bindings ──────────────────────────────────────

		on(el.importYear, 'input', function () { applyRecommended(); compute(); });
		on(el.exportYear, 'input', function () { applyRecommended(); compute(); });

		on(el.batterySlider, 'input', function () {
			if (el.batteryNum) el.batteryNum.value = parseFloat(el.batterySlider.value).toFixed(1);
			compute();
		});

		on(el.batteryNum, 'input', function () {
			if (el.batterySlider) el.batterySlider.value = parseFloat(el.batteryNum.value) || 0;
			compute();
		});

		['tbImportPrice','tbExportWithNet','tbExportPostNet'].forEach(function (pid) {
			on(id(pid), 'input', compute);
		});

		on(el.efficiency, 'input', function () {
			setText(el.effLbl, Math.round(parseFloat(el.efficiency.value)) + '%');
			compute();
		});

		on(el.cycles, 'input', function () {
			userTouchedCycles = true;
			var v = parseFloat(el.cycles.value).toFixed(1).replace('.', ',');
			setText(el.cyclesLbl, v + '×');
			compute();
		});

		on(el.priceSpread, 'input', compute);

		// Contract toggle
		function toggleContract() {
			var nowDyn = !isDynamic();
			setDynamic(nowDyn);
			if (!userTouchedCycles) {
				var target = nowDyn ? 1.2 : 1.0;
				if (el.cycles) el.cycles.value = target;
				setText(el.cyclesLbl, target.toFixed(1).replace('.', ',') + '×');
			}
			compute();
		}

		on(el.contractToggle, 'click', toggleContract);
		on(el.contractToggle, 'keydown', function (e) {
			if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleContract(); }
		});

		// Uitgebreide instellingen toggle
		on(el.advToggle, 'click', function () {
			var on = !el.advFields.classList.contains('tb-visible');
			el.advFields.classList.toggle('tb-visible', on);
			el.advToggle.setAttribute('aria-expanded', String(on));
			el.advToggle.textContent = on ? 'Verberg instellingen' : 'Uitgebreide instellingen';
		});

		// Reset
		on(el.resetBtn, 'click', function () {
			setVal(el.importYear, 2500);
			setVal(el.exportYear, 2500);
			setVal(el.batterySlider, 5);
			setVal(el.batteryNum, '5.0');
			setVal(el.importPrice, 0.30);
			setVal(el.exportWithNet, 0.12);
			setVal(el.exportPostNet, 0.04);
			setVal(el.efficiency, 80);
			setText(el.effLbl, '80%');
			setVal(el.cycles, 1.0);
			setText(el.cyclesLbl, '1,0×');
			setVal(el.priceSpread, 0.12);
			userTouchedCycles = false;
			setDynamic(false);
			applyRecommended();
			compute();
		});

		// Scroll naar producten
		on(el.scrollBtn, 'click', function () {
			var section = document.getElementById('tbProductsSection');
			if (section) {
				section.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		});

		function on(el, ev, fn) {
			if (el) el.addEventListener(ev, fn);
		}

		function setVal(el, v) {
			if (el) el.value = v;
		}

		// ── Init ────────────────────────────────────────────────
		setDynamic(false);
		applyRecommended();
		compute();
	}

	function id(name) {
		return document.getElementById(name);
	}

})();
