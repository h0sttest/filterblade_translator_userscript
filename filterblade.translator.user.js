// ==UserScript==
// @name         Filterblade Translator
// @namespace    filterblade.translator
// @version      3.28.15
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

	if(!localStorage.getItem("translator")) {
		let v = new Date().getTime();
		localStorage.setItem("translator:dropdown", v);
		localStorage.setItem("translator:dropdownDual", v);
		localStorage.setItem("translator:keephover", v);
		localStorage.setItem("translator", v);
	}

	let _DICT_ = _POE_DICT_;
	let trimRegex = /^(\s*)(.*?)(\s*)$/;
	let simRegex = /^(\s*)(?:\d+x )?(?:Superior )?(?:Synthesised )?(.*?)(?: \(Tier \d+\))?(\s*)$/;
	let disconnector = new EventTarget();
	let disconnect = disconnector.dispatchEvent.bind(disconnector, new Event('disconnect'));

	function navAccord(accord, depth = 0) {
		let content = accord.content;
		if(!content) {
			return observe(accord.id, accord);
		}
		for(let o of content) {
			if(o instanceof VisualDiv) {
				for(let d of o.content) {
					d && navAccord(d, ++depth);
				}
			} else if((o instanceof ElementAdder_Tier) || (o instanceof ElementAdder_Stat)) {
				for(let d of o.childElements) {
					d && navAccord(d, ++depth);
				}
			}
			observe(o.id, o);
		}
	}

	function observe(id, type) {
		let pre = "";
		if(type instanceof CustomSet || type == "list") {
			pre = "VisualSortableList";
			bindBTM(id);
			bindDropdown(id);
		} else if(type instanceof BaseTypeMatrixUI || type == "table") {
			pre = "ItemProgressionItemContainer";
			observe(id, "controlDropdown");
		} else if(type instanceof ItemProgressionUI || type == "progression") {
			pre = "ItemProgressionItemContainer";
		} else if(type instanceof VisualCheckboxButton || type == "checkbox") {
			pre = "CheckBoxButtonContainer";
		} else if(type instanceof ElementAdder_Tier || type == "addtier") {
			bindAdd(type);
		} else if(type instanceof ElementAdder_Stat || type == "addstat") {
			bindAdd(type);
		} else if(typeof type === 'string') {
			pre = type;
		}
		if(pre === "") return false;
		let node = document.getElementById(pre + id);
		if(node) {
			return bindObs(node);
		}
		return false
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
					opt.dataset.origin = origin;
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
			let origin = sel.querySelector(`[value="${trimmed}"]`)?.dataset.origin || null;
			if(!trimmed || !origin) return;
			inp.value = origin;
		}
		inp.addEventListener('keydown', (e) => {
			if(e.keyCode === 13)
				evt(e);
		}, true);
		btn.addEventListener('click', evt, true);
		bindObs(sel, callback);
	}

	function bindBTM(id) {
		let btm = document.getElementById("sortListContainer_BTM" + id);
		if(!btm || observe(id + "_BTM", "table")) return;
		let o = new MutationObserver(function (m, o) {
			observe(id + "_BTM", "table");
			o && o.disconnect();
		}).observe(btm, {
			childList: true
		});
		disconnector.addEventListener('disconnect', (e) => {
			o && o.disconnect();
		}, { once: true });
	} 

	function bindAdd(type) {
		if(!type || type.transBinded) return;
		type.transBinded = true;
		let arr = type.childElements;
		if(!arr || !(arr instanceof Array)) return;
		let bakPush = arr.push;
		arr.push = function(e) {
			setTimeout(() => {
				navAccord(e);
			}, 0);
			return bakPush.apply(this, arguments);
		}
	}

	function bindObs(node, arg) {
		if(!node) return false;
		if(node.dataset.transBinded) return true;
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
		return true;
	}

	if(!window.FilterBlade || !window.VisualAccordion_OnDemand)
		return console.error("Translator: Not Found");
	let bakInit = FilterBlade.prototype.initOrReload;
	let bakOpen = VisualAccordion_OnDemand.prototype.openAccordion;
	FilterBlade.prototype.initOrReload = async function() {
		if(this.gameType == "Poe1" && typeof _POE1_DICT_ !== 'undefined') {
			_DICT_ = _POE1_DICT_;
		} else if(this.gameType == "Poe2" && typeof _POE2_DICT_ !== 'undefined') {
			_DICT_ = _POE2_DICT_;
		} else {
			_DICT_ = _POE_DICT_;
		}
		disconnect();
		return bakInit.apply(this, arguments);
	}
	VisualAccordion_OnDemand.prototype.openAccordion = function() {
		if(localStorage.getItem("translator:info"))
			console.info(this);
		navAccord(this);
		bindObs(window.hoverBox);
		bindObs(window.LootSimulatorInnerDiv, simRegex);
		return bakOpen.apply(this, arguments);
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
		{ line-height: 1rem; }
	`));
	document.head.appendChild(css);
})();

