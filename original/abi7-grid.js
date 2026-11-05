'use strict';

const ABI7_GRID_CLASS = 'abi7-grid';
const ABI7_GRID_ITEM_CLASS = 'abi7-grid-item';
const ABI7_GRID_CENTER_CLASS = 'abi7-grid-center';
const ABI7_GRID_HELPER_CLASS = 'abi7-grid-helper';
const ABI7_GRID_SELECTED_CLASS = 'abi7-grid-selected';
const ABI7_GRID_VISIBLE_CLASS = 'abi7-grid-visible';
const ABI7_GRID_CONTAINER_CLASS = 'abi7-grid-container';
const ABI7_GRID_READY_CLASS = 'abi7-grid-ready';
const ABI7_GRID_TRANS_CLASS = 'abi7-grid-trans';
const ABI7_GRID_NOSCROLLBAR_CLASS = 'abi7-grid-noscrollbar';
const ABI7_GRID_SORTABLE_CLASS = 'abi7-grid-sortable';
const ABI7_GRID_DATAKEY_CLASS = '#grid-item-class';
const ABI7_GRID_STATE_NORMAL = 0;
const ABI7_GRID_STATE_BUILD = 1;
const ABI7_GRID_STATE_DISABLED = 2;
const ABI7_GRID_STATE_HIDDEN = 3;





class abi7_grid_item {

	
	constructor(grid, options) {
		const self = this;
		self.index = 0;
		self.loadIndex = 0;
		self.defaults = {}
		self.config = Object.assign({}, self.defaults, options);
		self.grid = grid;
		self.body = document.createElement(self.config.htmlTag);
		self.body.className = ABI7_GRID_ITEM_CLASS;
		self.body.item = self;
		self.grid.container.appendChild(self.body);
		self.init();
	}

	

	init() {
		const self = this;

		self.reset();

		if (self.grid.config.items.sortable) {
			self.body.addEventListener('touchstart', self.grid.sortStart, false);
			self.body.addEventListener('mousedown', self.grid.sortStart);
			self.body.addEventListener('touchend', self.grid.sortEnd, false);
			self.body.addEventListener('mouseup', self.grid.sortEnd);
			self.body.addEventListener('mouseout', self.grid.sortEnd);
			self.body.addEventListener('touchmove', self.grid.sortMove, false);
			self.body.addEventListener('mousemove', self.grid.sortMove, false);
		}

		const events = self.grid.events;
		const evList = [
			{ 'click': events.onItemClick },
			{ 'contextmenu': events.onItemContextMenu },
			{ 'dblclick': events.onItemDblClick },
			{ 'mouseenter': events.onItemMouseEnter },
			{ 'mouseleave': events.onItemMouseLeave }
		];

		evList.forEach(ev => {
			Object.entries(ev).forEach(i => {
				let [n, f] = i;
				if (typeof f === 'function') {
					self.body.addEventListener(n, e => {
						e.preventDefault();
						f(self.grid.owner, self, e);
					});
				}
			});
		});

		if (self.config.classSelected) {
			self.body.addEventListener('click', e => {
				const multiSelect = (e.ctrlKey && self.grid.config.items.multiSelect);
				if (!multiSelect) {
					self.grid.selectedItems = [];
				}
				const index = (self.grid.selectedItems.indexOf(self.index));
				if (index > -1) {
					self.grid.selectedItems.splice(index, 1);
				} else {
					self.grid.selectedItems.push(self.index);
				}
				self.grid.items.forEach(item => item.update());
			});
		}

		self.grid.itemsIntersectObserver.observe(self.body);
		self.grid.itemsCenterObserver.observe(self.body);
	}

	

	destroy() {
		const self = this;
		self.grid.itemsIntersectObserver.unobserve(self.body);
		self.grid.itemsCenterObserver.unobserve(self.body);
		self.body.remove();
	}

	

	reset() {
		const self = this;
		self.x = 0;
		self.y = 0;
		self.column = 0;
		self.valHeight = 0;
		self.valWidth = 0;
		self.valAspectRatio = false;
		self.center = false;
		self.visible = false;
		self.body.innerHTML = '';
		self.body.removeAttribute('style');
	}

	

	data(name, value) {
		const self = this;
		const store = self.grid.storage.cache[self.index];
		if (typeof name === 'string') {
			if (typeof value === 'undefined') {
				return (store.hasOwnProperty(name)) ? store[name] : undefined;
			} else {
				store[name] = value;
			}
		}
		else if (typeof name === 'object') {
			for (let prop in name) {
				store[prop] = name[prop];
			}
		}
		else if (typeof name === 'undefined') {
			return Object.assign({}, store);
		}
	}

	

	addClass(token) {
		const self = this;
		self.toggleClass(token, true);
	}

	

	removeClass(token) {
		const self = this;
		self.toggleClass(token, false);
	}

	

	toggleClass(token, force) {
		const self = this;
		let arr = [];
		let cls = self.body.classList.value;
		if (typeof token === 'string') {
			arr = token.split(' ');
		}
		else if (Array.isArray(token)) {
			arr = token;
		}
		arr.forEach(cls => {
			if (typeof add === 'undefined') {
				self.body.classList.toggle(cls);
			} else {
				self.body.classList.toggle(cls, force);
			}
		});
		if (self.body.classList.value !== cls) {
			self.data(ABI7_GRID_DATAKEY_CLASS, self.body.classList.value);
			
		}
	}

	

	load(html) {
		const self = this;
		self.body.innerHTML = '';
		if (typeof html === 'string') {
			self.body.innerHTML = html;
		}
		else if (html instanceof HTMLElement) {
			self.body.innerHTML = '';
			self.body.appendChild(html);
		} else {
			throw 'Invalid content type';
		}
		if (typeof self.grid.events.onItemLoaded === 'function') {
			self.grid.events.onItemLoaded(self.grid.owner, self);
		}
		self.update();
	}

	

	height(value) {
		const self = this;
		if (typeof value === 'undefined') {
			return self.valHeight;
		} else {
			if (typeof value === 'number') {
				self.setSize(null, value);
				self.data('abi7height', value);
			}
		}
	}

	

	aspectRatio(value) {
		const self = this;
		if (typeof value === 'undefined') {
			return self.valAspectRatio;
		} else {
			if (typeof value === 'number' && value !== 0) {
				if (self.valAspectRatio !== value) {
					self.valAspectRatio = value;
					self.setSize(null, Math.round(self.valWidth / value));
					self.data('abi7aspectRatio', value);
				}
			} else {
				self.valAspectRatio = false;
				self.data('abi7aspectRatio', false);
			}
		}
	}

	

	remove() {
		const self = this;
		let grid = self.grid;

		if (!grid.stateIsNormal()) {
			return;
		}

		grid.state(ABI7_GRID_STATE_BUILD);
		let index = self.index;
		let items = grid.items.filter(i => i.index > index);
		items.forEach(i => i.index--);
		grid.storage.items.splice(index, 1);
		let data = grid.storage.cache.splice(index, 1);
		self.setPosition(null, -self.valHeight);
		self.index = -1;
		grid.state(ABI7_GRID_STATE_NORMAL);

		grid.recalcItems(index, {
			itemsUpdate: true,
			itemsToSkip: [-1]
		}, () => {
			if (typeof grid.events.onItemDelete === 'function') {
				grid.events.onItemDelete(grid.owner, data, index);
			}
		});
	}

	

	setPosition(x, y) {
		const self = this;
		if (typeof x !== 'number') {
			x = self.x;
		}
		if (typeof y !== 'number') {
			y = self.y;
		}

		if (self.x !== x || self.y !== y) {
			self.x = x;
			self.y = y;
			self.body.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
		}
	}

	

	setSize(width, height) {
		const self = this;
		let update = false;

		if (typeof width === 'number' && width !== self.valWidth) {
			self.body.style.width = width + 'px';
			self.valWidth = width;
			update = true;
		}
		if (typeof height === 'number' && height !== self.valHeight) {
			self.body.style.height = height + 'px';
			self.valHeight = height;
			update = true;
			if (self.grid.stateIsNormal()) {
				let obj = self.grid.storage.items[self.index];
				if (obj) {
					obj.height = height;
					obj.bottom = obj.top + height;
				}
				self.grid.recalcItems(self.index + 1, {
					itemsUpdate: true,
					animation: false
				});
			}
		}
		if (update) {
			self.body.style.setProperty('contain-intrinsic-size', self.valWidth + 'px ' + self.valHeight + 'px');
		}
	}

	

	setCenter(value) {
		const self = this;
		if (self.center !== value) {
			self.center = value;
			if (self.config.classCenter) {
				self.body.classList.toggle(ABI7_GRID_CENTER_CLASS, value);
			}
			if (value) {
				if (typeof self.grid.events.onItemCenterEnter === 'function') {
					self.grid.events.onItemCenterEnter(self.grid.owner, self);
				}
			} else {
				if (typeof self.grid.events.onItemCenterExit === 'function') {
					self.grid.events.onItemCenterExit(self.grid.owner, self);
				}
			}
		}
	}

	

	setVisible(value) {
		const self = this;
		if (self.visible !== value) {
			self.visible = value;
			if (self.config.classVisible) {
				self.body.classList.toggle(ABI7_GRID_VISIBLE_CLASS, value);
			}
			if (typeof self.grid.events.onItemVisibility === 'function') {
				self.grid.events.onItemVisibility(self.grid.owner, self, value);
			}
			if (value) {
				if (typeof self.grid.events.onItemEnter === 'function') {
					self.grid.events.onItemEnter(self.grid.owner, self);
				}
			} else {
				if (typeof self.grid.events.onItemExit === 'function') {
					self.grid.events.onItemExit(self.grid.owner, self);
				}
			}
		}
	}

	

	update() {
		const self = this;
		if (self.body.innerHTML === '') {
			return;
		}
		const h = self.body.clientHeight;
		if (h !== self.valHeight) {
			self.setSize(null, h);
		}
		self.body.classList.toggle(ABI7_GRID_SELECTED_CLASS, (self.grid.selectedItems.indexOf(self.index) > -1));
	}
}





class abi7_grid_custom {

	

	constructor(element, options, owner) {
		const self = this;
		self.defaults = {
			itemsCount: 0,
			dataBlockSize: 0,
			autoRender: true,
			grid: {
				htmlTag: 'ul',
				height: false,
				scrollbar: true
			},
			padding: {
				top: 0,
				left: 0,
				right: 0,
				bottom: 0
			},
			space: {
				cols: 5,
				rows: 5
			},
			items: {
				aspectRatio: false,
				classCenter: false,
				classVisible: false,
				classSelected: false,
				height: false,
				htmlTag: 'li',
				minWidth: 150,
				maxWidth: 250,
				multiSelect: false,
				sortable: false,
				sortStartDelay: 200,
				sortStartColor: false
			},
			animation: {
				enable: true,
				duration: 400,
				function: 'linear'
			},
			maxColumns: 3,
			funcLoadData: false,
			funcItemLoad: false,
			funcItemCalc: false,
			events: {
				onBof: false,
				onEof: false,
				onCalcSize: false,
				onChangeVisible: false,
				onChangeDirection: false,
				onDataLoadStart: false,
				onDataLoadEnd: false,
				onScroll: false,
				onScrollEnd: false,
				onSortStart: false,
				onSortEnd: false,
				onItemCenterEnter: false,
				onItemCenterExit: false,
				onItemContextMenu: false,
				onItemClick: false,
				onItemDblClick: false,
				onItemDelete: false,
				onItemEnter: false,
				onItemExit: false,
				onItemInsert: false,
				onItemLoaded: false,
				onItemMouseEnter: false,
				onItemMouseLeave: false,
				onItemVisibility: false,
				onReady: false,
				onResize: false
			}
		}
		self.config = Object.assign({}, self.defaults, options);
		for (let prop in options) {
			if (typeof options[prop] === 'object' && !Array.isArray(options[prop])) {
				self.config[prop] = Object.assign({}, self.defaults[prop], options[prop]);
			}
		}
		self.element = (typeof element === 'string') ? document.querySelector(element) : element;
		if (!(self.element instanceof HTMLElement)) {
			throw 'Invalid element parameter';
		}
		self.element.classList.add(ABI7_GRID_CLASS);
		self.element.setAttribute('tabindex', '0');

		self.owner = owner || self;

		self.children = Array.from(self.element.children);

		self.container = document.createElement(self.config.grid.htmlTag);
		self.container.classList.add(ABI7_GRID_CONTAINER_CLASS);
		self.element.appendChild(self.container);
		self.init();
	}

	init(fdone) {
		const self = this;
		let config = self.config;
		self.events = config.events;
		self.visible = false;

		self.element.classList.toggle(ABI7_GRID_SORTABLE_CLASS, config.items.sortable);

		if (typeof config.animation.duration === 'number') {
			self.element.style.setProperty('--grid-animation-duration', parseInt(config.animation.duration) + 'ms');
		}
		if (typeof config.animation.function === 'string') {
			self.element.style.setProperty('--grid-animation-function', config.animation.function);
		}
		if (typeof config.items.sortStartColor === 'string') {
			self.element.style.setProperty('--grid-sort-start-color', config.items.sortStartColor);
		}

		if (config.grid.height) {
			let valHeight = false;
			let valMaxHeight = false;
			if (Number.isInteger(config.grid.height)) {
				valHeight = config.grid.height + 'px';
				valMaxHeight = valHeight;
			}
			else if (typeof config.grid.height === 'string') {
				valHeight = config.grid.height;
			}
			if (valHeight !== false) {
				self.element.style.setProperty('--grid-height', valHeight);
			}
			if (valMaxHeight !== false) {
				self.element.style.setProperty('--grid-max-height', valMaxHeight);
			}
		}
		if (!config.grid.scrollbar) {
			self.element.classList.add(ABI7_GRID_NOSCROLLBAR_CLASS);
		}

		self.scrollbox = self.element;
		if (config.grid.scrollbox) {
			self.scrollbox = (typeof config.grid.scrollbox === 'string') ? document.querySelector(config.grid.scrollbox) : config.grid.scrollbox;
			if (!(self.scrollbox instanceof HTMLElement)) {
				throw 'Invalid grid.scrollbox parameter';
			}
		}

		if (config.autoRender) {
			self.render(fdone);
		}
	}

	

	render(fdone) {
		const self = this;

		if (self.ready) {
			self.reload(fdone);
			return;
		}

		self.initProps();
		self.initFunctions();
		self.initSizingParams();
		self.initObservers();
		self.initEvents();

		

		if (Array.isArray(self.config.data)) {
			self.setData(self.config.data);
		}

		

		self.items = [];
		while (self.items.length < self.itemsCount) {
			let item = new abi7_grid_item(self, self.config.items);
			self.items.push(item);
		}

		self.initLoadData(fdone);
	}

	

	initProps() {
		const self = this;
		self.gridState = ABI7_GRID_STATE_BUILD;
		self.storage = {};
		self.storage.cache = [];
		self.storage.items = [];
		self.undo = [];
		self.selectedItems = [];
		self.can_event = true;
		self.ready = false;
		self.forward = true;
		self.inScroll = false;

		self.scroll_top = 0;
		self.cursor_pos = 0;
		self.bof = true;
		self.eof = false;
		self.eof_data = false;
		self.scrolling = false;

		self.touchTimer = 0;
		self.canMove = false;

		self.cursor_begin = 0;
		self.cursor_end = 0;

		self.eSort = false;

		self.resizeTimer = 0;
		self.resizeWidth = self.container.clientWidth;

		

		if (self.children.length) {
			self.config.itemsCount = self.children.length;

			self.config.funcLoadData = (self, start, count) => {
				return self.children.slice(start, start + count);
			}

			self.config.funcItemLoad = (self, item, data) => {
				item.body.appendChild(data);
				item.height(data.clientHeight);
			}
		}
	}

	

	initFunctions() {
		const self = this;
		let config = self.config;

		self.sortFwd = (a, b) => { return a.index - b.index }
		self.sortRev = (a, b) => { return b.index - a.index }

		self.setData = function (data) {
			self.storage.cache = [];
			self.storage.items = [];
			self.storage.cache = data;
			self.eof_data = true;
		}

		self.array_move_item = function (arr, pos1, pos2) {
			let cut = arr.splice(pos1, 1).find(a => true);
			if (cut) {
				arr.splice(pos2, 0, cut);
			}
		}

		self.scrollTop = function (value) {
			if (typeof value === 'number') {
				self.scrollbox.scrollTop = value;
			} else {
				let r0 = self.scrollbox.getBoundingClientRect();
				let r1 = self.container.getBoundingClientRect();
				return r0.top - r1.top;
			}
		}

		self.updateHeight = function () {
			let h = Math.max.apply(null, self.storage.items.slice(-self.column_count * 2).map(i => i.bottom)) + config.padding.bottom;
			self.container.style.height = h + 'px';
			if (self.config.grid.height === 'auto') {
				h += self.config.padding.top + self.config.padding.bottom;
				self.element.style.setProperty('--grid-height', h + 'px');
				self.element.style.setProperty('--grid-max-height', h + 'px');
			}
		}

		self.onResize = function (e) {
			clearTimeout(self.resizeTimer);
			self.resizeTimer = setTimeout(function (e) {
				if (self.container.clientWidth != self.resizeWidth) {
					self.resizeWidth = self.container.clientWidth;
					self.eventResize(e);
				}
			}, 250);
		}

		self.onCheck = function (e) {
			clearTimeout(self.scrolling);
			self.scrolling = setTimeout(function () {
				if (self.stateIsNormal()) {
					self.checkItems(function () {
						if (typeof self.events.onScrollEnd === 'function') self.events.onScrollEnd(self.owner, e);
					});
				}
			}, 200
			);
		}

		self.getESort = function (el, e) {
			let item = el.item;
			let t = (e.touches && e.touches[0]) || (e.pointerType && e.pointerType === 'touch' && e) || e;
			return {
				element: el,
				item,
				enable: false,
				index: item.index,
				timer: 0,
				clientX: t.clientX,
				clientY: t.clientY,
				screenX: t.screenX,
				screenY: t.screenY,
				trX: item.x,
				trY: item.y
			}
		}

		self.sortStart = function (e) {
			if (!self.can_event) return;
			if (e.type === 'mousedown' && e.which != 1) return;

			let el = this;
			self.eSort = self.getESort(el, e);

			self.eSort.timer = setTimeout(() => {
				if (typeof self.events.onSortStart === 'function') {
					self.events.onSortStart(self.owner, item);
				}
				self.eSort.enable = true;
				el.style.zIndex = 1;
				el.classList.add(ABI7_GRID_SORTABLE_CLASS);
				self.container.classList.add(ABI7_GRID_HELPER_CLASS);
			}, config.items.sortStartDelay);
		}

		self.sortEnd = function (e) {
			if (!self.eSort) return;

			let el = self.eSort.element;
			let item = self.eSort.item;
			let id = item.index;
			let pos = self.storage.items[id];

			clearTimeout(self.eSort.timer);
			self.eSort = false;

			item.setPosition(pos.left, pos.top);

			el.style.zIndex = 0;
			el.classList.remove(ABI7_GRID_SORTABLE_CLASS);
			self.container.classList.remove(ABI7_GRID_HELPER_CLASS);

			[].forEach.call(self.container.style, s => {
				if (typeof s === 'string' && s.indexOf('--helper') === 0) {
					self.container.style.removeProperty(s);
				}
			});

			if (typeof self.events.onSortEnd === 'function') {
				self.events.onSortEnd(self.owner, item, pos);
			}
		}

		self.sortMove = function (e) {
			let eMove = self.getESort(this, e);
			let eStart = Object.assign({}, eMove, self.eSort);

			let absX = Math.abs(eMove.screenX - eStart.screenX);
			let absY = Math.abs(eMove.screenY - eStart.screenY);

			if (!eStart.enable) {
				if (absX > 5 || absY > 5) {
					if (self.eSort.timer) {
						clearTimeout(self.eSort.timer);
					}
					self.eSort = false;
					return;
				}
			}

			if (!(self.can_event && eStart.enable)) return;

			e.preventDefault();
			e.stopPropagation();

			let el = eStart.element;
			let item = eStart.item;

			let moveX = eStart.trX + (eMove.clientX - eStart.clientX);
			let moveY = eStart.trY + (eMove.clientY - eStart.clientY);

			item.setPosition(moveX, moveY);

			let elms = self.getItems().screen_all.map(c => c.body).filter(c => !Object.is(c, el));

			let calcOverlapArea = (r1, r2) => {
				let xo = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
				let yo = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
				return xo * yo;
			}

			let r1 = el.getBoundingClientRect();
			let a1 = r1.height * r1.width;
			elms = elms.filter(c => {
				let r2 = c.getBoundingClientRect();
				let a2 = r2.height * r2.width;
				let oa = calcOverlapArea(r1, r2);
				return (oa > Math.min(a1, a2) / 2);
			});

			if (!elms.length) return;

			let overEL = elms.reduce((a, c) => (c.item.index < a.item.index) ? c : a);

			if (typeof overEL === 'undefined' || overEL.classList.contains(ABI7_GRID_TRANS_CLASS)) return;

			let overItem = overEL.item;
			let ovrID = overItem.index;
			let elID = item.index;

			self.array_move_item(self.storage.cache, elID, ovrID);
			self.array_move_item(self.storage.items, elID, ovrID);

			item.index = -1;

			let funcFin = (id) => {
				item.index = ovrID;
				self.recalcItems(id, {
					itemsUpdate: true,
					itemsToSkip: [ovrID],
					funcPreCalc: (g, i, p) => {
						if (i === ovrID) {
							let s = self.container.style;
							s.setProperty('--helper-height', p.height + 'px');
							s.setProperty('--helper-width', self.item_width + 'px');
							s.setProperty('--helper-top', p.top + 'px');
							s.setProperty('--helper-left', p.left + 'px');
							s.setProperty('--helper-opacity', 0.5);
						}
					}
				}, null);
			}

			if (elID < ovrID) {
				self.items.forEach(i => {
					let id = i.index;
					if (id > elID && id <= ovrID) {
						i.index = id - 1;
					}
				});
				funcFin(elID);
			} else if (elID > ovrID) {
				self.items.forEach(i => {
					let id = i.index;
					if (id >= ovrID && id < elID) {
						i.index = id + 1;
					}
				});
				funcFin(ovrID);
			}
		}
	}

	

	initEvents() {
		const self = this;

		self.element.addEventListener('mousewheel', e => {
			if (!self.stateIsNormal()) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		}, { passive: false });

		self.element.addEventListener('scroll', e => {
			if (!self.stateIsNormal()) {
				e.preventDefault();
				return false;
			}
			self.onCheck();
			if (typeof self.events.onScroll === 'function') self.events.onScroll(self.owner, e);
		}, { passive: false });

		if (!self.resizeObserver) {
			window.addEventListener('resize', self.onResize, false);
		}
	}

	

	initObservers() {
		const self = this;

		try {
			self.mainObserver = new IntersectionObserver(entries => {
				entries.forEach(entry => {
					let update = (!self.visible && entry.isIntersecting);
					self.setVisible(entry.isIntersecting);
					if (update) {
						if (self.container.clientWidth !== self.grid_width) {
							self.refresh();
						} else {
							self.checkItems();
						}
					}
				});
			}, { rootMargin: '0px', threshold: 0.000001 });
			self.mainObserver.observe(self.element);

			self.itemsIntersectObserver = new IntersectionObserver(entries => {
				entries.forEach(entry => {
					let item = entry.target.item;
					if (!item) return;

					item.setVisible(entry.isIntersecting);
				});
				self.eventScroll();
			}, {
				root: self.scrollbox,
				rootMargin: '0px 0px',
				threshold: 0.000001
			});

			self.itemsCenterObserver = new IntersectionObserver(entries => {
				entries.forEach(entry => {
					let item = entry.target.item;
					if (!item) return;
					item.setCenter(entry.isIntersecting);
				});
			}, {
				root: self.element,
				rootMargin: '-50% 0% -50% 0%',
				threshold: 0.000001
			});

		} catch (e) {
			throw e.message;
		}

		try {
			self.resizeObserver = new ResizeObserver(entries => {
				entries.forEach(entry => {
					self.onResize();
				});
			});
			self.resizeObserver.observe(self.element);
		} catch (e) {
			self.resizeObserver = false;
		}
	}

	

	initSizingParams() {
		const self = this;
		let config = self.config;

		let width_full = self.container.clientWidth;
		let width = width_full - (config.padding.left + config.padding.right);
		let item_width = Math.min(width, config.items.maxWidth);
		let column_count = (config.maxColumns > 0) ? config.maxColumns : 16;
		let calc_width = 0;

		while (column_count > 1) {
			calc_width = config.items.minWidth * column_count + config.space.cols * (column_count - 1);
			if (calc_width <= width) {
				item_width = config.items.minWidth;
				while (item_width < config.items.maxWidth) {
					calc_width = (item_width + 1) * column_count + config.space.cols * (column_count - 1);
					if (calc_width >= width) {
						break;
					}
					item_width++;
				}
				break;
			}
			column_count--;
		}

		self.left = Math.max(config.padding.left, (width_full - ((config.space.cols + item_width) * column_count - config.space.cols)) / 2);
		self.column_count = column_count;
		self.item_width = item_width;
		self.grid_width = width_full;
		self.calc_width = calc_width;
		self.item_aspectRatio = (typeof config.items.aspectRatio === 'number' && config.items.aspectRatio > 0) ? config.items.aspectRatio : false;
		self.item_height = (Number.isInteger(config.items.height) && config.items.height > 0) ? config.items.height : false;
		if (self.item_aspectRatio) {
			self.item_height = Math.round(self.item_width / self.item_aspectRatio);
		}

		
		self.itemsCount = (config.itemsCount) ? config.itemsCount : Math.max(20, column_count * 20);
		
		self.dataBlockSize = (config.dataBlockSize) ? config.dataBlockSize : Math.max(100, column_count * 40);

		
		if (typeof self.events.onSizeCalc === 'function') {
			self.events.onSizeCalc(self.owner, {
				columnCount: column_count,
				gridCalcWidth: calc_width,
				gridWidth: width_full,
				itemWidth: item_width
			});
		}

		self.ratio = self.item_width / config.items.maxWidth;

		self.element.style.setProperty('--grid-ratio', self.ratio);
		self.element.style.setProperty('--grid-column-width', self.item_width + 'px');
		self.element.setAttribute('data-columns-count', self.column_count);
	}

	

	initLoadData(fdone) {
		const self = this;

		self.items.forEach(i => i.reset());
		self.buffer = self.items;
		self.loadData(false, false, {}, () => {
			self.ready = true;
			self.state(ABI7_GRID_STATE_NORMAL);
			if (typeof self.events.onReady === 'function') {
				self.events.onReady(self.owner);
			}
			if (typeof fdone === 'function') {
				fdone(self.owner);
			}

			self.itemsCount = self.items.length;
		});
	}

	

	animation(items, value, fdone) {
		const self = this;

		if (!Array.isArray(items)) {
			items = self.items;
		}

		let func = () => {
			items.forEach(i => i.body.classList.toggle(ABI7_GRID_TRANS_CLASS, value));
			if (typeof fdone === 'function') {
				fdone();
			}
		}
		if (self.config.animation.enable) {
			if (value) {
				func();
			} else {
				setTimeout(func, self.config.animation.duration + 50);
			}
		}
	}

	

	getItemByIndex(value) {
		const self = this;
		return self.items.find(i => i.index === value);
	}

	

	gridGetItems() {
		const self = this;
		return self.items.map(i => i);
	}

	

	state(value) {
		const self = this;
		if (typeof value === 'undefined') {
			return self.gridState;
		} else {
			self.gridState = value;
			self.element.classList.toggle(ABI7_GRID_READY_CLASS, value === ABI7_GRID_STATE_NORMAL);
		}
	}

	

	stateIsNormal(options) {
		const self = this;
		let cfg = Object.assign({}, {
			checkVisible: true,
			checkScroll: true,
			checkReady: true
		}, options);
		let ok = (cfg.checkReady ? self.ready : true) && (cfg.checkVisible ? self.visible : true) && (cfg.checkScroll ? !self.inScroll : true);
		return (self.gridState === ABI7_GRID_STATE_NORMAL && ok);
	}

	

	setVisible(value) {
		const self = this;
		if (self.visible !== value) {
			self.visible = value;
			self.element.classList.toggle(ABI7_GRID_VISIBLE_CLASS, value);
			if (typeof self.events.onChangeVisible === 'function') {
				self.events.onChangeVisible(self.owner, value);
			}
		}
	}

	

	checkItems(fdone) {
		const self = this;

		if (!self.stateIsNormal()) {
			return;
		}

		let items = self.getItems();
		let funcFin = function () {
			if (self.bof &&
				typeof self.events.onBof === 'function' &&
				items.min_screen_id === 0 &&
				items.screen.find(i => i.index === 0)) {
				self.events.onBof(self.owner);
			}
			if (self.eof &&
				typeof self.events.onEof === 'function' &&
				items.max_screen_id === self.storage.cache.length - 1 &&
				items.screen.find(i => i.index === items.max_screen_id)) {
				self.events.onEof(self.owner);
			}
			if (typeof fdone === 'function') fdone();
		}

		let count = 0;
		let start = 0;

		let notop = items.all.length >= self.column_count && items.screen_top.length < self.column_count && items.min_id > 0;
		let nobot = items.all.length >= self.column_count && items.screen_bot.length < self.column_count;

		if (nobot && notop) {
			let scroll_offs = self.scrollTop();
			start = self.storage.items.findIndex(i => i.bottom >= scroll_offs);
			if (start > -1) {
				if (self.eof_data && start + self.itemsCount > self.storage.cache.length) {
					start = self.storage.cache.length - self.itemsCount;
				}
				self.buffer = self.items;
				self.loadData(start, self.itemsCount, {}, funcFin);
			}
		} else if (notop) {
			self.buffer = items.off_all;
			self.buffer.sort(self.sortRev);
			count = self.buffer.length;
			start = Math.max(0, items.min_screen_id - count);
			count = items.min_screen_id - start;
			self.loadData(start, count, {}, funcFin);
		} else if (nobot) {
			self.buffer = items.off_all;
			self.buffer.sort(self.sortFwd);
			start = items.max_screen_id + 1;
			count = self.buffer.length;
			if (!self.eof || (self.eof && start < self.cursor_end)) {
				self.loadData(start, count, {}, funcFin);
			} else {
				funcFin();
			}
		} else {
			funcFin();
		}
	}

	

	findNextPos() {
		const self = this;
		let config = self.config;
		let left = 0;
		let top = 0;
		let index = self.cursor_pos;
		let column = index;

		if (index < self.column_count) {
			left = index * (config.space.cols + self.item_width) + self.left;
			top = config.padding.top - config.space.rows;
		} else {
			
			if (self.column_count > 1) {
				let arr = [];
				for (let i = index - 1; i >= 0; i--) {
					let store = self.storage.items[i];
					let find = arr.find(a => a.left === store.left);
					if (!find) {
						arr.push(store);
					}
					if (arr.length >= self.column_count) {
						break;
					}
				}
				arr = arr.sort((a, b) => b.bottom - a.bottom);
				arr = arr.pop();
				left = arr.left;
				top = arr.bottom;
				column = arr.column;

				
			} else {
				if (index > 0) {
					let tmp = self.storage.items[index - 1];
					left = tmp.left;
					top = tmp.bottom;
				}
				column = 0;
			}
		}
		return { left: left, top: top + config.space.rows, column };
	}

	

	getItems() {
		const self = this;
		let config = self.config;
		let cols_rect = self.scrollbox.getBoundingClientRect();
		let screenTop = cols_rect.top;
		let screenBottom = cols_rect.bottom;
		let min_screen_id = Number.MAX_SAFE_INTEGER;
		let max_screen_id = Number.MIN_SAFE_INTEGER;
		let screen_center = (screenBottom - screenTop) / 2;
		let min_id = min_screen_id;
		let max_id = max_screen_id;
		let all = self.items;
		let screen = [];
		let screen_all = [];
		let center = [];
		let off1 = [];
		let off2 = [];
		let screen_top = [];
		let screen_bot = [];

		self.items.forEach(item => {
			let rect = item.body.getBoundingClientRect();
			let data_id = item.index;
			let t = rect.top;
			let b = rect.bottom;

			if (b <= screenTop) off1.push(item);
			if (t >= screenBottom) off2.push(item);
			if (t >= screenTop && b <= screenBottom) {
				screen.push(item);
				center.push({ item, val: Math.abs((t + (b - t) / 2) - screen_center) });
			}

			if (b > screenTop && t <= screenTop + config.space.cols) screen_top.push(item);
			if (t < screenBottom && b >= screenBottom - config.space.cols) screen_bot.push(item);

			if ((t >= screenTop && t < screenBottom) || (b > screenTop && b <= screenBottom) || (t <= screenTop && b >= screenBottom)) {
				min_screen_id = Math.min(min_screen_id, data_id);
				max_screen_id = Math.max(max_screen_id, data_id);
				screen_all.push(item);
			}
			min_id = Math.min(min_id, data_id);
			max_id = Math.max(max_id, data_id);
		});

		off1.sort(self.sortFwd);
		for (let i = 0; i < off1.length; i++) {
			if (i > 0 && off1[i].index !== off1[i - 1].index + 1) {
				off1 = off1.slice(0, i);
				break;
			}
		}

		if (center.length > 1) center = center.reduce(function (p, c) { return (p.val > c.val) ? c : p });
		return {
			all,
			screen,
			screen_all,
			screen_top,
			screen_bot,
			center: (center.item) ? center.item : [],
			off1,
			off2,
			off_all: [].concat(off1, off2),
			min_id,
			max_id,
			min_screen_id: (min_screen_id == Number.MAX_SAFE_INTEGER) ? 0 : min_screen_id,
			max_screen_id: (max_screen_id == Number.MIN_SAFE_INTEGER) ? 0 : max_screen_id,
			screenTop
		}
	}

	

	recalcStorageItems(count, fdone) {
		const self = this;
		let config = self.config;
		count = count || self.storage.cache.length;

		self.storage.items = [];
		for (let i = 0; i < count; i++) {
			self.cursor_pos = i;
			let dat = self.storage.cache[i];
			let obj = self.findNextPos();
			let height = (typeof dat.abi7height === 'number' && dat.abi7height > 0) ? dat.abi7height : false;
			let ratio = (typeof dat.abi7aspectRatio === 'number' && dat.abi7aspectRatio > 0) ? dat.abi7aspectRatio : false;

			if (self.item_height) {
				obj.height = self.item_height;
			}
			else if (ratio) {
				obj.height = Math.round(self.item_width / ratio);
			}
			else if (height) {
				obj.height = height;
			}
			else if (typeof config.funcItemCalc === 'function') {
				obj.height = config.funcItemCalc(self, {
					x: obj.left,
					y: obj.top,
					column: obj.column,
					height: obj.height,
					width: self.item_width
				}, self.storage.cache[i]);
			}
			obj.bottom = obj.top + obj.height;
			self.storage.items.push(obj);
		}
		if (typeof fdone === 'function') {
			fdone(self.owner);
		}
	}

	
	

	refresh(fdone) {
		const self = this;
		let config = self.config;

		if (!self.stateIsNormal()) {
			return;
		}

		self.state(ABI7_GRID_STATE_BUILD);

		self.initSizingParams();

		let items = self.getItems();
		let min_screen = Math.min.apply(null, items.screen_all.map(i => i.index));

		self.recalcStorageItems(self.storage.items.length, () => {
			self.updateHeight();
			items = self.getItems();

			items.all.forEach((item, i) => {
				let obj = self.storage.items[item.index];
				if (obj) {
					item.setSize(self.item_width, obj.height);
					item.setPosition(null, obj.top);
				}
				if (min_screen === i) {
					self.scrollTop(obj.top + config.padding.top);
				}
			});

			self.animation(items.screen_all, true);

			items.all.forEach(item => {
				let obj = self.storage.items[item.index];
				if (obj) {
					item.setPosition(obj.left, obj.top);
				}
			});

			self.animation(items.screen_all, false, () => {
				self.state(ABI7_GRID_STATE_NORMAL);
				self.checkItems(() => {
					if (typeof fdone === 'function') fdone(self.owner);
				});
			});
		});
	}

	
	

	updateItemsPosition(items, fdone) {
		const self = this;
		if (!self.stateIsNormal()) {
			return;
		}

		self.state(ABI7_GRID_STATE_BUILD);
		self.animation(items, true);

		items.forEach(item => {
			let data = self.storage.items[item.index];
			if (data) {
				item.setPosition(data.left, data.top);
			}
		});

		self.animation(items, false, () => {
			self.state(ABI7_GRID_STATE_NORMAL);
			if (typeof fdone === 'function') {
				fdone();
			}
		});
	}

	
	

	recalcItems(pos, options, fdone) {
		const self = this;

		if (!self.stateIsNormal()) {
			return;
		}

		let def = {
			itemsUpdate: false,
			itemsToSkip: [],
			funcPreCalc: false,
			animation: self.config.animation.enable
		}
		let cfg = Object.assign({}, def, options);
		let func_done = function () {
			self.state(ABI7_GRID_STATE_NORMAL);
			if (typeof fdone === 'function') fdone(self.owner);
		}
		let items = self.items.filter(i => !cfg.itemsToSkip.includes(i.index));

		self.state(ABI7_GRID_STATE_BUILD);

		pos = pos || 0;

		if (cfg.animation) {
			self.animation(items, true);
		}

		for (let i = pos; i < self.storage.items.length; i++) {
			self.cursor_pos = i;
			let nxt = self.findNextPos();
			let obj = self.storage.items[i];

			if (obj === undefined) {
				return;
			}

			obj.left = nxt.left;
			obj.top = nxt.top;
			obj.bottom = nxt.top + obj.height;
			obj.column = nxt.column;

			if (typeof cfg.funcPreCalc === 'function') {
				cfg.funcPreCalc(self, i, obj);
			}

			if (cfg.itemsUpdate && !cfg.itemsToSkip.includes(i)) {
				let item = self.getItemByIndex(i);
				if (item) {
					item.setPosition(nxt.left, nxt.top);
				}
			}
		}

		self.updateHeight();
		if (cfg.animation) {
			self.animation(items, false, func_done);
		} else {
			func_done();
		}
	}

	

	eventResize() {
		const self = this;
		self.refresh(() => {
			if (typeof self.events.onResize === 'function') {
				self.events.onResize(self.owner);
			}
		});
	}

	

	eventScroll(fdone) {
		const self = this;

		if (!self.stateIsNormal()) {
			return;
		}

		self.inScroll = true;

		let scroll_top = self.scrollTop();
		let items = self.getItems();
		let forward = scroll_top > self.scroll_top;
		let start = 0;
		let count = 0;
		let funcFin = () => {
			self.scroll_top = scroll_top;
			self.inScroll = false;
			if (typeof fdone === 'function') {
				fdone(self.owner);
			}
		}

		if (forward !== self.forward) {
			self.forward = forward;
			if (typeof self.events.onChangeDirection === 'function') {
				self.events.onChangeDirection(self.owner, forward);
			}
		}

		self.element.classList.toggle('abi7-grid-scroll-up', !forward);
		
		if (forward && !self.eof && items.off2.length <= items.off_all.length / 3) {
			self.buffer = items.off1;
			let max_index = items.max_id;
			start = max_index + 1;
			count = self.buffer.length;
			self.loadData(start, count, {}, funcFin);
		}

		
		else if (!forward && !self.bof && items.min_screen_id > 0 && items.off1.length <= items.off_all.length / 3) {
			self.buffer = items.off2;
			let min_index = items.min_id;
			self.buffer.sort(self.sortRev);
			count = self.buffer.length;
			start = Math.max(0, min_index - count);
			count = min_index - start;
			self.loadData(start, count, {}, funcFin);
		}

		else {
			funcFin();
		}
	}

	

	itemPrepare(item) {
		const self = this;
	}

	

	itemInsert(data, fdone) {
		const self = this;

		if (!self.stateIsNormal()) {
			return;
		}

		if (typeof data !== 'object') {
			throw 'Data parameter must be an object';
		}

		self.scrollTop(0);

		self.storage.cache.unshift(data);
		self.storage.items = [];

		self.buffer = self.items;
		self.buffer.sort(self.sortRev);

		self.loadData(false, false, { setX: false, reset: false }, () => {
			setTimeout(() => {
				self.updateItemsPosition(self.items, () => {
					if (typeof self.events.onItemInsert === 'function') {
						self.events.onItemInsert(self.owner, data);
					}
					if (typeof fdone === 'function') {
						fdone(self.owner);
					}
				});
			}, 50);
		});
	}

	

	loadData(start, count, options, fdone) {
		const self = this;
		let config = self.config;
		let def = {
			setX: true,
			setY: true,
			reset: true
		}
		let cfg = Object.assign({}, def, options);

		self.state(ABI7_GRID_STATE_BUILD);

		if (!start) start = 0;
		if (!count) count = self.itemsCount;

		start = Math.max(0, start);
		count = Math.min(count, self.buffer.length);

		self.cursor_pos = start;

		let dataFunc = function (data) {

			if (typeof self.events.onDataLoadEnd === 'function') {
				self.events.onDataLoadEnd(self.owner, data);
			}

			count = Math.min(count, data.length, self.buffer.length);
			for (let i = 0; i < count; i++) {
				let cached = (self.storage.items[self.cursor_pos] !== undefined);
				let new_pos = (cached) ? self.storage.items[self.cursor_pos] : self.findNextPos();
				let new_item = self.buffer[i];
				let new_data = data[i];
				let itemHeight = 0;
				let el = new_item.body;

				if (cfg.reset) {
					new_item.reset();
				}
				new_item.loadIndex = i;
				new_item.index = self.cursor_pos;
				new_item.column = new_pos.column;

				new_item.setPosition((cfg.setX) ? new_pos.left : null, (cfg.setY) ? new_pos.top : null);
				new_item.setSize(self.item_width, null);

				if (typeof config.funcItemLoad === 'function') {
					config.funcItemLoad(self, new_item, new_data);
				} else {
					throw 'Please define the function "funcItemLoad"';
				}

				if (self.item_height) {
					itemHeight = self.item_height;
				}
				else if (typeof new_data.abi7aspectRatio === 'number' && new_data.abi7aspectRatio > 0) {
					itemHeight = Math.round(self.item_width / new_data.abi7aspectRatio);
				}
				else if (typeof new_data.abi7height === 'number' && new_data.abi7height > 0) {
					itemHeight = new_data.abi7height;
				} else {
					itemHeight = el.clientHeight;
				}

				new_item.setSize(null, itemHeight);

				self.itemPrepare(new_item);

				if (!cached) {
					self.storage.items[self.cursor_pos] = {
						left: new_pos.left,
						top: new_pos.top,
						height: itemHeight,
						bottom: new_pos.top + itemHeight,
						ratio: self.ratio,
						column: new_pos.column
					}
				}
				self.cursor_pos++;
			}

			if (count > 0) {
				self.updateHeight();
				self.cursor_begin = start;
				self.cursor_end = self.cursor_pos;
			}
			self.bof = (self.cursor_begin == 0 || start == 0);
			self.eof = (self.eof_data && self.cursor_end >= self.storage.cache.length - 1);
			self.buffer = [];

			self.state(ABI7_GRID_STATE_NORMAL);
			if (typeof fdone === 'function') fdone({ count });
		}

		if (typeof self.events.onDataLoadStart === 'function') {
			self.events.onDataLoadStart(self.owner);
		}

		if (start + count <= self.storage.cache.length || self.eof_data) {
			dataFunc(self.storage.cache.slice(start, start + count));
		} else {
			let res = config.funcLoadData(self, start + (self.storage.cache.length - start), self.dataBlockSize);
			let func = (data) => {
				self.eof_data = (data.length < self.dataBlockSize);
				self.storage.cache = self.storage.cache.concat(data);
				dataFunc(self.storage.cache.slice(start, start + count));
			}
			if (Array.isArray(res)) {
				func(res);
			}
			else if (typeof res === 'object' && typeof res.then === 'function') {
				res.then(func);
			}
			else {
				throw 'Unexpected data format';
			}
		}
	}

	
	data(data, fdone) {
		const self = this;

		if (!self.stateIsNormal()) {
			return;
		}

		if (Array.isArray(data)) {
			if (typeof self.events.onDataLoadStart === 'function') {
				self.events.onDataLoadStart(self.owner);
			}
			self.scrollTop(0);
			self.initProps();
			self.setData(data);
			self.recalcStorageItems(null, () => {
				self.initLoadData(() => {
					if (typeof self.events.onDataLoadEnd === 'function') {
						self.events.onDataLoadStart(self.owner);
					}
					if (typeof fdone === 'function') {
						fdone(self.owner);
					}
				});
			});
		}
		else if (typeof data === 'undefined') {
			return self.storage.cache;
		}
		else {
			throw 'Unexpected data format';
		}
	}

	

	rebuild(options, fdone) {
		const self = this;

		let config = Object.assign({}, self.config, options);
		config.autoRender = true;
		for (let prop in options) {
			if (typeof options[prop] === 'object' && !Array.isArray(options[prop])) {
				config[prop] = Object.assign({}, self.config[prop], options[prop]);
			}
		}
		self.config = config;
		if (Array.isArray(self.items)) {
			self.items.forEach(i => i.destroy());
			self.items = [];
		}
		if (self.ready) {
			self.ready = false;
			self.scrollTop(0);
		}
		self.init(() => {
			if (typeof fdone === 'function') {
				fdone(self.owner);
			}
		});
	}

	

	reload(fdone) {
		const self = this;

		if (!self.stateIsNormal({ checkVisible: false })) {
			return;
		}

		self.scrollTop(0);
		self.initProps();
		if (self.container.clientWidth !== self.grid_width) {
			self.initSizingParams();
		}
		self.initLoadData(() => {
			if (typeof fdone === 'function') {
				fdone(self.owner);
			}
		});
	}

	

	exportMethods(self) {
		return {
			data: self.data,
			itemInsert: self.itemInsert,
			items: self.gridGetItems,
			rebuild: self.rebuild,
			refresh: self.refresh,
			render: self.render,
			reload: self.reload
		}
	}

}





class abi7_grid {

	constructor(element, options) {
		const grid = new abi7_grid_custom(element, options, this);
		const expt = grid.exportMethods(grid);
		for (let f in expt) {
			this[f] = expt[f].bind(grid);
		}
	}
}
