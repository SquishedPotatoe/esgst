const elementData = new WeakMap();

function toArray(value) {
	if (value == null) return [];
	if (value instanceof JQueryCompatCollection) return value.elements.slice();
	if (Array.isArray(value)) return value.filter(Boolean);
	if (isArrayLikeDomCollection(value)) return Array.from(value).filter(Boolean);
	return [value].filter(Boolean);
}

function isArrayLikeDomCollection(value) {
	return (
		!!value &&
		typeof value.length === 'number' &&
		typeof value !== 'string' &&
		typeof value !== 'function' &&
		!isDomNode(value) &&
		(typeof value.item === 'function' || Object.prototype.toString.call(value) === '[object NodeList]' || Object.prototype.toString.call(value) === '[object HTMLCollection]')
	);
}

function isDomElement(value) {
	return !!value && value.nodeType === 1;
}

function isDomNode(value) {
	return !!value && typeof value.nodeType === 'number';
}

function isEventLike(value) {
	return !!value && typeof value.type === 'string' && 'target' in value;
}

function isCustomEventLike(value) {
	return isEventLike(value) && 'detail' in value;
}

function parseEventName(eventName) {
	const [type, ...namespaces] = eventName.split('.');
	return {
		type,
		namespaces: Array.from(new Set(namespaces.filter(Boolean))).sort(),
	};
}

function namespaceMatches(needle, haystack) {
	return needle.length === 0 || needle.every((namespace) => haystack.includes(namespace));
}

function getStore(element) {
	let store = elementData.get(element);
	if (!store) {
		store = {
			data: new Map(),
			events: [],
		};
		elementData.set(element, store);
	}
	return store;
}

function matchesSelector(element, selector) {
	if (!selector) return true;
	if (!isDomElement(element)) return false;
	const normalizedSelector = normalizeSelector(selector);
	const baseSelector = stripUnsupportedPseudos(normalizedSelector).trim() || '*';
	if (!element.matches(baseSelector)) return false;
	return applyPseudoFilters([element], normalizedSelector).length > 0;
}

function normalizeSelector(selector) {
	if (typeof selector !== 'string') return selector;
	let normalized = selector;
	const trimmed = normalized.trim();
	if (trimmed.startsWith('>')) {
		normalized = `:scope ${trimmed}`;
	}
	return normalized.replaceAll(':selected', ':checked');
}

function applyPseudoFilters(elements, selector) {
	let filtered = elements;
	if (selector.includes(':checked')) {
		filtered = filtered.filter((element) => !!element.checked);
	}
	if (selector.includes(':selected')) {
		filtered = filtered.filter((element) => !!element.selected);
	}
	if (selector.includes(':empty')) {
		filtered = filtered.filter((element) => element.childNodes.length === 0);
	}
	return filtered;
}

function stripUnsupportedPseudos(selector) {
	return selector
		.replaceAll(':checked', '')
		.replaceAll(':selected', '')
		.replaceAll(':empty', '');
}

function canUseDomEvents(target) {
	return !!target?.addEventListener && !!target?.removeEventListener && typeof target.dispatchEvent === 'function';
}

function findDelegatedTarget(container, eventTarget, selector, path = []) {
	if (isDomElement(eventTarget)) {
		const closestMatch = eventTarget.closest(selector);
		if (closestMatch && (closestMatch === container || container.contains(closestMatch))) {
			return closestMatch;
		}
	}
	return path.find((node) => isDomElement(node) && matchesSelector(node, selector) && (node === container || container.contains(node))) || null;
}

function unique(elements) {
	return Array.from(new Set(elements));
}

function appendContent(target, content, mode) {
	const nodes = normalizeContent(content);
	nodes.forEach((node) => {
		const child = node;
		if (mode === 'prepend') {
			target.insertBefore(child, target.firstChild);
		} else if (mode === 'after') {
			target.parentNode?.insertBefore(child, target.nextSibling);
		} else {
			target.appendChild(child);
		}
	});
}

function normalizeContent(content) {
	if (content instanceof JQueryCompatCollection) {
		return content.elements;
	}
	if (typeof content === 'string') {
		return $.parseHTML(content);
	}
	if (isArrayLikeDomCollection(content) && !isDomNode(content)) {
		return Array.from(content);
	}
	if (Array.isArray(content)) {
		return content.flatMap((item) => normalizeContent(item));
	}
	if (content == null) {
		return [];
	}
	if (isDomNode(content)) {
		return [content];
	}
	return [document.createTextNode(String(content))];
}

function createEvent(type, props = {}) {
	let defaultPrevented = !!props.defaultPrevented;
	let propagationStopped = false;
	let immediatePropagationStopped = false;
	const parsed = parseEventName(type);
	return {
		type: parsed.type,
		namespace: parsed.namespaces.join('.'),
		target: props.target ?? null,
		currentTarget: props.currentTarget ?? null,
		delegateTarget: props.delegateTarget ?? null,
		originalEvent: props.originalEvent ?? null,
		which: props.which,
		value: props.value,
		builder: props.builder,
		rule: props.rule,
		group: props.group,
		error: props.error,
		preventDefault() {
			defaultPrevented = true;
			this.defaultPrevented = true;
			this.originalEvent?.preventDefault?.();
		},
		stopPropagation() {
			propagationStopped = true;
			this.propagationStopped = true;
			this.originalEvent?.stopPropagation?.();
		},
		stopImmediatePropagation() {
			immediatePropagationStopped = true;
			propagationStopped = true;
			this.immediatePropagationStopped = true;
			this.propagationStopped = true;
			this.originalEvent?.stopImmediatePropagation?.();
		},
		isDefaultPrevented() {
			return defaultPrevented || !!this.originalEvent?.defaultPrevented;
		},
		isPropagationStopped() {
			return propagationStopped;
		},
		isImmediatePropagationStopped() {
			return immediatePropagationStopped;
		},
		...props,
	};
}

function normalizeEventMap(events, selector, handler) {
	if (typeof events === 'object' && events !== null) {
		return Object.entries(events).map(([eventName, eventHandler]) => ({
			eventName,
			selector: typeof selector === 'string' ? selector : null,
			handler: eventHandler,
		}));
	}
	if (typeof selector === 'function') {
		handler = selector;
		selector = null;
	}
	return String(events)
		.split(/\s+/)
		.filter(Boolean)
		.map((eventName) => ({
			eventName,
			selector,
			handler,
		}));
}

class JQueryCompatCollection {
	constructor(elements) {
		this.elements = unique(toArray(elements));
		this.length = this.elements.length;
		for (let i = 0; i < this.length; i++) {
			this[i] = this.elements[i];
		}
	}

	each(callback) {
		this.elements.forEach((element, index) => callback.call(element, index, element));
		return this;
	}

	map(callback) {
		return this.elements.map((element, index) => callback.call(element, index, element));
	}

	get(index) {
		if (index == null) return this.elements.slice();
		return this.elements[index < 0 ? this.length + index : index];
	}

	eq(index) {
		const element = this.get(index);
		return $(element ? [element] : []);
	}

	find(selector) {
		const normalizedSelector = normalizeSelector(selector);
		const optionStateMatch = normalizedSelector.match(/^(.*)\s+option:(selected|checked)$/);
		if (optionStateMatch) {
			const selectSelector = optionStateMatch[1].trim();
			return $(
				this.elements.flatMap((element) =>
					Array.from(element.querySelectorAll(selectSelector)).flatMap((selectElement) => {
						if (selectElement.tagName !== 'SELECT') return [];
						return Array.from(selectElement.options).filter((option) => option.selected);
					})
				)
			);
		}
		const baseSelector = stripUnsupportedPseudos(normalizedSelector).trim() || '*';
		return $(
			this.elements.flatMap((element) =>
				applyPseudoFilters(Array.from(element.querySelectorAll(baseSelector)), normalizedSelector)
			)
		);
	}

	parent() {
		return $(this.elements.map((element) => element.parentElement).filter(Boolean));
	}

	children(selector) {
		const children = this.elements.flatMap((element) => Array.from(element.children));
		return selector ? $(children.filter((child) => matchesSelector(child, selector))) : $(children);
	}

	closest(selector) {
		return $(this.elements.map((element) => element.closest(selector)).filter(Boolean));
	}

	is(selector) {
		return this.elements.some((element) => matchesSelector(element, selector));
	}

	filter(predicate) {
		if (typeof predicate === 'string') {
			return $(this.elements.filter((element) => matchesSelector(element, predicate)));
		}
		return $(this.elements.filter((element, index) => predicate.call(element, index, element)));
	}

	add(other) {
		return $(this.elements.concat(toArray(other)));
	}

	append(content) {
		return this.each((index, element) => appendContent(element, index === 0 ? content : cloneContent(content), 'append'));
	}

	prepend(content) {
		return this.each((index, element) => appendContent(element, index === 0 ? content : cloneContent(content), 'prepend'));
	}

	prependTo(target) {
		const targets = toArray(target);
		targets.forEach((currentTarget, targetIndex) => {
			this.elements.forEach((element, elementIndex) => {
				const node = targetIndex === 0 && elementIndex === 0 ? element : element.cloneNode(true);
				currentTarget.insertBefore(node, currentTarget.firstChild);
			});
		});
		return this;
	}

	insertAfter(target) {
		const targets = toArray(target);
		targets.forEach((currentTarget, targetIndex) => {
			this.elements.forEach((element, elementIndex) => {
				const node = targetIndex === 0 && elementIndex === 0 ? element : element.cloneNode(true);
				currentTarget.parentNode?.insertBefore(node, currentTarget.nextSibling);
			});
		});
		return this;
	}

	remove() {
		return this.each((_, element) => element.remove());
	}

	empty() {
		return this.each((_, element) => {
			element.textContent = '';
		});
	}

	html(value) {
		if (value === undefined) {
			return this[0]?.innerHTML;
		}
		if (typeof value === 'string') {
			return this.each((_, element) => {
				element.innerHTML = value;
			});
		}
		return this.each((index, element) => {
			element.textContent = '';
			appendContent(element, index === 0 ? value : cloneContent(value), 'append');
		});
	}

	css(property, value) {
		if (typeof property === 'string' && value === undefined) {
			return this[0] ? getComputedStyle(this[0])[property] : undefined;
		}
		return this.each((_, element) => {
			if (typeof property === 'string') {
				element.style[property] = value;
			} else {
				Object.entries(property).forEach(([key, propertyValue]) => {
					element.style[key] = propertyValue;
				});
			}
		});
	}

	attr(name, value) {
		if (typeof name === 'object') {
			return this.each((_, element) => {
				Object.entries(name).forEach(([key, propertyValue]) => {
					if (propertyValue == null) {
						element.removeAttribute(key);
					} else {
						element.setAttribute(key, String(propertyValue));
					}
				});
			});
		}
		if (value === undefined) {
			return this[0]?.getAttribute(name);
		}
		return this.each((_, element) => {
			if (value == null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, String(value));
			}
		});
	}

	prop(name, value) {
		if (value === undefined) {
			return this[0]?.[name];
		}
		return this.each((_, element) => {
			element[name] = value;
		});
	}

	val(value) {
		if (value === undefined) {
			const element = this[0];
			if (!element) return undefined;
			if (element.tagName === 'SELECT' && element.multiple) {
				return Array.from(element.options)
					.filter((option) => option.selected)
					.map((option) => option.value);
			}
			return element.value;
		}
		return this.each((_, element) => {
			if (element.tagName === 'SELECT') {
				const values = Array.isArray(value) ? value.map(String) : [String(value)];
				let matched = false;
				Array.from(element.options).forEach((option) => {
					const isSelected = values.includes(option.value);
					option.selected = isSelected;
					if (isSelected) {
						matched = true;
					}
				});
				if (element.multiple) {
					if (!matched) {
						Array.from(element.options).forEach((option) => {
							option.selected = false;
						});
					}
					return;
				}
				if (!matched) {
					element.selectedIndex = -1;
					return;
				}
				const selectedOption = Array.from(element.options).find((option) => option.selected);
				element.selectedIndex = selectedOption ? selectedOption.index : -1;
				return;
			}
			element.value = value;
		});
	}

	addClass(className) {
		const classNames = className.split(/\s+/).filter(Boolean);
		return this.each((_, element) => element.classList.add(...classNames));
	}

	removeClass(className) {
		if (!className) {
			return this.each((_, element) => {
				element.className = '';
			});
		}
		const classNames = className.split(/\s+/).filter(Boolean);
		return this.each((_, element) => element.classList.remove(...classNames));
	}

	toggleClass(className, force) {
		const classNames = className.split(/\s+/).filter(Boolean);
		return this.each((_, element) => {
			classNames.forEach((name) => element.classList.toggle(name, force));
		});
	}

	data(key, value) {
		if (!this[0]) return value === undefined ? undefined : this;
		if (value === undefined) {
			return getStore(this[0]).data.get(key);
		}
		return this.each((_, element) => {
			getStore(element).data.set(key, value);
		});
	}

	removeData(key) {
		return this.each((_, element) => {
			if (key === undefined) {
				getStore(element).data.clear();
			} else {
				getStore(element).data.delete(key);
			}
		});
	}

	on(events, selector, handler) {
		normalizeEventMap(events, selector, handler).forEach(({ eventName, selector: delegatedSelector, handler: mappedHandler }) => {
			const parsed = parseEventName(eventName);
			this.each((_, element) => {
				const store = getStore(element);
				const wrappedHandler = (nativeEventOrCustom) => {
					const path = isEventLike(nativeEventOrCustom)
						? nativeEventOrCustom.composedPath?.() ?? []
						: [];
					const extraParameters =
						isCustomEventLike(nativeEventOrCustom) && Array.isArray(nativeEventOrCustom.detail)
							? nativeEventOrCustom.detail
							: [];
					let matchedTarget = element;
					if (delegatedSelector) {
						matchedTarget = findDelegatedTarget(
							element,
							nativeEventOrCustom?.target ?? null,
							delegatedSelector,
							path
						);
						if (!matchedTarget) return;
					}
					const eventObject = nativeEventOrCustom?.__jqEvent ?? createEvent(parsed.type, {
						currentTarget: matchedTarget,
						delegateTarget: element,
						originalEvent: isEventLike(nativeEventOrCustom) ? nativeEventOrCustom : null,
						target: nativeEventOrCustom?.target ?? matchedTarget,
					});
					eventObject.currentTarget = matchedTarget;
					eventObject.delegateTarget = element;
					mappedHandler.call(matchedTarget, eventObject, ...extraParameters);
					if (wrappedHandler.once) {
						$(element).off(eventName, delegatedSelector, mappedHandler);
					}
				};
				wrappedHandler.originalHandler = mappedHandler;
				wrappedHandler.selector = delegatedSelector;
				wrappedHandler.namespaces = parsed.namespaces;
				wrappedHandler.once = false;
				store.events.push({
					eventName,
					type: parsed.type,
					namespaces: parsed.namespaces,
					selector: delegatedSelector,
					handler: mappedHandler,
					wrappedHandler,
				});
				if (canUseDomEvents(element)) {
					element.addEventListener(parsed.type, wrappedHandler);
				}
			});
		});
		return this;
	}

	one(events, selector, handler) {
		normalizeEventMap(events, selector, handler).forEach(({ eventName, selector: delegatedSelector, handler: mappedHandler }) => {
			const parsed = parseEventName(eventName);
			this.each((_, element) => {
				const store = getStore(element);
				const wrappedHandler = (nativeEventOrCustom) => {
					const path = isEventLike(nativeEventOrCustom)
						? nativeEventOrCustom.composedPath?.() ?? []
						: [];
					const extraParameters =
						isCustomEventLike(nativeEventOrCustom) && Array.isArray(nativeEventOrCustom.detail)
							? nativeEventOrCustom.detail
							: [];
					let matchedTarget = element;
					if (delegatedSelector) {
						matchedTarget = findDelegatedTarget(
							element,
							nativeEventOrCustom?.target ?? null,
							delegatedSelector,
							path
						);
						if (!matchedTarget) return;
					}
					const eventObject = nativeEventOrCustom?.__jqEvent ?? createEvent(parsed.type, {
						currentTarget: matchedTarget,
						delegateTarget: element,
						originalEvent: isEventLike(nativeEventOrCustom) ? nativeEventOrCustom : null,
						target: nativeEventOrCustom?.target ?? matchedTarget,
					});
					eventObject.currentTarget = matchedTarget;
					eventObject.delegateTarget = element;
					mappedHandler.call(matchedTarget, eventObject, ...extraParameters);
					$(element).off(eventName, delegatedSelector, mappedHandler);
				};
				wrappedHandler.originalHandler = mappedHandler;
				wrappedHandler.selector = delegatedSelector;
				wrappedHandler.namespaces = parsed.namespaces;
				wrappedHandler.once = true;
				store.events.push({
					eventName,
					type: parsed.type,
					namespaces: parsed.namespaces,
					selector: delegatedSelector,
					handler: mappedHandler,
					wrappedHandler,
				});
				if (canUseDomEvents(element)) {
					element.addEventListener(parsed.type, wrappedHandler);
				}
			});
		});
		return this;
	}

	off(events, selector, handler) {
		if (typeof selector === 'function') {
			handler = selector;
			selector = null;
		}
		const eventNames = events && typeof events === 'object'
			? Object.keys(events)
			: (events ? String(events).split(/\s+/).filter(Boolean) : ['']);
		return this.each((_, element) => {
			const store = getStore(element);
			store.events = store.events.filter((entry) => {
				const shouldRemove = eventNames.some((eventName) => {
					const parsed = parseEventName(eventName);
					const typeMatches = !parsed.type || parsed.type === entry.type;
					const namespaceMatchesResult = namespaceMatches(parsed.namespaces, entry.namespaces);
					const selectorMatches = selector == null || selector === entry.selector;
					const handlerMatches = handler == null || handler === entry.handler;
					return typeMatches && namespaceMatchesResult && selectorMatches && handlerMatches;
				});
				if (shouldRemove) {
					if (canUseDomEvents(element)) {
						element.removeEventListener(entry.type, entry.wrappedHandler);
					}
				}
				return !shouldRemove;
			});
		});
	}

	trigger(event, extraParameters = []) {
		const eventObject = typeof event === 'string' ? $.Event(event) : event;
		const parameters = Array.isArray(extraParameters) ? extraParameters : [extraParameters];
		return this.each((_, element) => {
			eventObject.target = element;
			if (canUseDomEvents(element)) {
				const nativeEvent = new CustomEvent(eventObject.type, {
					bubbles: true,
					cancelable: true,
					detail: parameters,
				});
				nativeEvent.__jqEvent = eventObject;
				element.dispatchEvent(nativeEvent);
				return;
			}
			const store = getStore(element);
			store.events.forEach((entry) => {
				const parsed = parseEventName(eventObject.type + (eventObject.namespace ? `.${eventObject.namespace}` : ''));
				const typeMatches = parsed.type === entry.type;
				const namespaceMatchesResult = namespaceMatches(parsed.namespaces, entry.namespaces);
				if (typeMatches && namespaceMatchesResult) {
					const syntheticEvent = createEvent(eventObject.type, {
						...eventObject,
						target: element,
						currentTarget: element,
						delegateTarget: element,
					});
					entry.handler.call(element, syntheticEvent, ...parameters);
				}
			});
		});
	}

	triggerHandler(event, extraParameters = []) {
		const eventObject = typeof event === 'string' ? $.Event(event) : event;
		const parameters = Array.isArray(extraParameters) ? extraParameters : [extraParameters];
		const element = this[0];
		if (!element) return undefined;
		const store = getStore(element);
		let result;
		store.events.forEach((entry) => {
			const parsed = parseEventName(eventObject.type + (eventObject.namespace ? `.${eventObject.namespace}` : ''));
			const typeMatches = parsed.type === entry.type;
			const namespaceMatchesResult = namespaceMatches(parsed.namespaces, entry.namespaces);
			if (typeMatches && namespaceMatchesResult) {
				eventObject.target = element;
				eventObject.currentTarget = element;
				eventObject.delegateTarget = element;
				result = entry.handler.call(element, eventObject, ...parameters);
			}
		});
		return result;
	}
}

function cloneContent(content) {
	return normalizeContent(content).map((node) => node.cloneNode(true));
}

function $(input) {
	if (typeof input === 'function') {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', input, { once: true });
		} else {
			input();
		}
		return new JQueryCompatCollection([]);
	}
	if (typeof input === 'string') {
		const trimmed = input.trim();
		if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
			return new JQueryCompatCollection($.parseHTML(trimmed));
		}
		return new JQueryCompatCollection(document.querySelectorAll(trimmed));
	}
	return new JQueryCompatCollection(input);
}

$.fn = JQueryCompatCollection.prototype;
$.extend = function (...args) {
	let deep = false;
	let target;
	let index = 0;
	if (typeof args[0] === 'boolean') {
		deep = args[0];
		index++;
	}
	target = args[index] ?? {};
	index++;
	for (; index < args.length; index++) {
		const source = args[index];
		if (source == null) continue;
		Object.keys(source).forEach((key) => {
			const value = source[key];
			if (deep && (Array.isArray(value) || $.isPlainObject(value))) {
				const base = Array.isArray(value)
					? (Array.isArray(target[key]) ? target[key] : [])
					: ($.isPlainObject(target[key]) ? target[key] : {});
				target[key] = $.extend(true, base, value);
			} else {
				target[key] = value;
			}
		});
	}
	return target;
};
$.each = function (collection, callback) {
	if (Array.isArray(collection) || collection instanceof JQueryCompatCollection) {
		toArray(collection).forEach((value, index) => callback.call(value, index, value));
		return collection;
	}
	Object.keys(collection || {}).forEach((key) => callback.call(collection[key], key, collection[key]));
	return collection;
};
$.map = function (collection, callback) {
	const result = [];
	$.each(collection, (key, value) => {
		const mapped = callback(value, key);
		if (mapped != null) {
			if (Array.isArray(mapped)) {
				result.push(...mapped);
			} else {
				result.push(mapped);
			}
		}
	});
	return result;
};
$.isFunction = function (value) {
	return typeof value === 'function';
};
$.isPlainObject = function (value) {
	if (value == null || Object.prototype.toString.call(value) !== '[object Object]') return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};
$.isEmptyObject = function (value) {
	return !value || Object.keys(value).length === 0;
};
$.parseHTML = function (html) {
	const template = document.createElement('template');
	template.innerHTML = html.trim();
	return Array.from(template.content.childNodes);
};
$.Event = function (type, props) {
	return createEvent(type, props);
};

$.ready = (callback) => $(callback);

module.exports = $;
module.exports.default = $;
module.exports.$ = $;
