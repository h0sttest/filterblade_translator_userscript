// ==UserScript==
// @name         Filterblade Translator
// @namespace    filterblade.translator
// @version      3.28.9
// @description  translate filterblade.xyz
// @author       hosttest
// @run-at       document-end
// @match        http*://*.filterblade.xyz/*
// @match        http*://filterblade.xyz/*
// @require      https://github.com/h0sttest/filterblade_translator_userscript/raw/refs/heads/main/_DICT_.js
// @updateURL    https://github.com/h0sttest/filterblade_translator_userscript/raw/refs/heads/main/filterblade.translator.user.js
// @downloadURL  https://github.com/h0sttest/filterblade_translator_userscript/raw/refs/heads/main/filterblade.translator.user.js
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	// @_POE1_DICT_ PoE1 전용
	// @_POE2_DICT_ PoE2 전용
	// @_POE_DICT_ PoE1 + PoE2
	const _DICT_ = _POE_DICT_;

	if(!localStorage.getItem("translator")) {
		let v = new Date().getTime();
		localStorage.setItem("translator:dropdown", v);
		localStorage.setItem("translator:dropdownDual", v);
		localStorage.setItem("translator:keephover", v);
		localStorage.setItem("translator", v);
	}

	let trimRegex = /^(\s*)(.*?)(\s*)$/;
	let simRegex = /^(\s*)(?:\d+x )?(?:Superior )?(?:Synthesised )?(.*?)(?: \(Tier \d+\))?(\s*)$/;
	let disconnector = new EventTarget();
	let disconnect = disconnector.dispatchEvent.bind(disconnector, new Event('disconnect'));

	function navAccord(accord, depth = 0) {
		for(let o of accord.content) {
			if(o instanceof VisualDiv) {
				for(let d of o.content) {
					observe(d.id, d);
				}
			} else if(o instanceof ElementAdder_Tier) {
				for(let d of o.childElements) {
					navAccord(d, ++depth);
				}
			} else {
				observe(o.id, o);
			}
		}
	}

	function observe(id, type) {
		let pre = "";
		if(type instanceof CustomSet || type == "list") {
			pre = "VisualSortableList";
			bindDropdown(id);
		} else if(type instanceof BaseTypeMatrixUI || type == "table") {
			pre = "ItemProgressionItemContainer";
		} else if(type instanceof VisualCheckboxButton || type == "checkbox") {
			pre = "CheckBoxButtonContainer";
		}
		if(pre === "") return;
		let node = document.getElementById(pre + id);
		if(node) {
			bindObs(node);
		}
	}

	function bindDropdown(id) {
		let inp = document.getElementById("VisualSortableListTextInput" + id);
		let sel = inp.list || document.getElementById("VisualSortableListTextInput"+id+"_data");
		let btn = document.getElementById("VisualSortableList_AddButton" + id);
		if(!inp || !sel || !btn) return;
		function callback(m) {
			if(!localStorage.getItem("translator:dropdown") || !localStorage.getItem("translator")) return;
			let dual = !!localStorage.getItem("translator:dropdownDual");
			sel.childNodes.forEach((opt) => {
				let origin = opt.value;
				let trim = trimRegex.exec(origin);
				let trimmed = trim[2];
				let trans = _DICT_[trimmed];
				if(trimmed && trans && trimmed !== trans) {
					opt.value = (trim[1] || trim[3]) ? origin.replace(trimmed, trans) : trans;
					if(dual) {
						opt.textContent = origin;
					}
				}
			});
		}
		function evt(e) {
			let trans = inp.value;
			let trim = trimRegex.exec(trans);
			let trimmed = trim[2];
			let origin = Object.keys(_DICT_)[Object.values(_DICT_).indexOf(trimmed)];
			if(!trimmed || !origin) return;
			inp.value = (trim[1] || trim[3]) ? trans.replace(trimmed, origin) : origin;
		}
		inp.addEventListener('keydown', (e) => {
			if(e.keyCode === 13)
				evt(e);
		}, true);
		btn.addEventListener('click', evt, true);
		bindObs(sel, callback);
	}

	function bindObs(node, arg) {
		if(!node || node.dataset.transBinded) return;
		node.dataset.transBinded = "true";
		let regex = (arg instanceof RegExp) ? arg : trimRegex;
		let callback = (arg instanceof Function) ? arg : function(m) {
			if(!localStorage.getItem("translator")) return;
			let walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, (text) => {
				if(!text.nodeValue || !_DICT_[regex.exec(text.nodeValue)[2]])
					return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			});
			let text;
			while((text = walker.nextNode())) {
				let origin = text.nodeValue;
				let trim = regex.exec(origin);
				let trimmed = trim[2];
				let trans = _DICT_[trimmed];
				if(trimmed !== trans) {
					text.nodeValue = (trim[1] || trim[3]) ? origin.replace(trimmed, trans) : trans;
				}
			}
		}
		callback();
		let o = new MutationObserver(callback).observe(node, {
			childList: true
		});
		disconnector.addEventListener('disconnect', (e) => {
			o && o.disconnect();
		}, { once: true });
	}

	if(!window.ChangeStorage || !window.VisualAccordion_OnDemand)
		return console.error("Translator: Not Found");
	let bakOpen = VisualAccordion_OnDemand.prototype.openAccordion;
	let bakClear = ChangeStorage.prototype.clearStorage;
	VisualAccordion_OnDemand.prototype.openAccordion = function() {
		navAccord(this);
		bindObs(window.hoverBox);
		bindObs(window.LootSimulatorInnerDiv, simRegex);
		return bakOpen.apply(this, arguments);
	}
	ChangeStorage.prototype.clearStorage = function() {
		disconnect();
		return bakClear.apply(this, arguments);
	}
})();


// keep showing hover tooltip
(function() {
	let key = false;
	let evt = (e) => key = e.ctrlKey || e.shiftKey;
	document.addEventListener('keydown', evt);
	document.addEventListener('keyup', evt);
	window.clearHoverBox = function(e) {
		e || (e = document.getElementById("hoverBox"));
		e && !(key && !!localStorage.getItem("translator:keephover") && e.matches(":hover")) && (e.style.display = "none")
	}
})();


// add CSS
(function() {
	let css = document.createElement('style');
	css.type = 'text/css';
	css.appendChild(document.createTextNode(`
		.BTM_TableCell > .ItemProgression_ItemLabel
		{ vertical-align: top !important; overflow: visible !important; }
	`));
	document.head.appendChild(css);
})();

