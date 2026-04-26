const collator = new Intl.Collator(undefined, {
	sensitivity: 'base',
});

function compareTypes(obj, type) {
	return Object.prototype.toString.call(obj).toLowerCase() === `[object ${type}]`;
}

function getPath(pathString) {
	return pathString.split(/\.|\[|]/).filter((x) => x);
}

function is(obj, type) {
	switch (type) {
		case 'number': {
			return typeof obj === 'number' && !Number.isNaN(obj);
		}
		case 'object': {
			return obj !== null && compareTypes(obj, 'object');
		}
		case 'string': {
			return typeof obj === 'string';
		}
		default: {
			return false;
		}
	}
}

function isDeepEqual(obj1, obj2) {
	if (obj1 === obj2) {
		return true;
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		return (
			obj1.length === obj2.length && obj1.every((value, index) => isDeepEqual(value, obj2[index]))
		);
	}

	if (
		obj1 &&
		obj2 &&
		typeof obj1 === 'object' &&
		typeof obj2 === 'object' &&
		!(obj1 instanceof Node) &&
		!(obj2 instanceof Node)
	) {
		const obj1Entries = Object.entries(obj1);

		return (
			obj1Entries.length === Object.keys(obj2).length &&
			obj1Entries.every(([key, value]) => isDeepEqual(value, obj2[key]))
		);
	}

	return obj1 === obj2;
}

function getProperty(obj, path) {
	if (!Array.isArray(path)) {
		path = getPath(path);
	}

	return path.reduce((current, key) => current?.[key] ?? null, obj);
}

function getPlural(count, singular, plural) {
	if (count === 1) {
		return singular;
	}
	return plural ?? `${singular}s`;
}

function hex2Rgba(hex, alpha) {
	const alphaNumber = parseFloat(alpha);

	if (alphaNumber === 1.0) {
		return hex;
	}

	const match = hex.match(/[\dA-Fa-f]{2}/g);

	if (!match) {
		return '';
	}

	const red = parseInt(match[0], 16);
	const green = parseInt(match[1], 16);
	const blue = parseInt(match[2], 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function rgba2Hex(string) {
	const match = string.match(/rgba?\((\d+?),\s*(\d+?),\s*(\d+?)(,\s*(.+?))?\)/);

	if (!match) {
		return {
			hex: string,
			alpha: 1.0,
		};
	}

	const red = `0${parseInt(match[1]).toString(16)}`.slice(-2);
	const green = `0${parseInt(match[2]).toString(16)}`.slice(-2);
	const blue = `0${parseInt(match[3]).toString(16)}`.slice(-2);
	const alpha = (match[5] && parseFloat(match[5])) || 1.0;

	return {
		hex: `#${red}${green}${blue}`,
		alpha,
	};
}

function setProperty(obj, path, value) {
	if (!Array.isArray(path)) {
		path = getPath(path);
	}

	const key = path.pop();
	const property = getProperty(obj, path);

	property[key] = value;
}

function sortArray(array, desc, key) {
	if (array == null || !Array.isArray(array)) {
		throw 'The "array" argument is not an array';
	}

	return array.sort((a, b) => {
		let valueA = a;
		let valueB = b;

		if (is(a, 'object') && is(b, 'object')) {
			if (!(is(key, 'string') && a[key] != null && b[key] != null)) {
				return 0;
			}

			valueA = a[key];
			valueB = b[key];
		}

		let result;
		if (is(valueA, 'number') && is(valueB, 'number')) {
			result = valueA - valueB;
		} else {
			result = collator.compare(`${valueA}`, `${valueB}`);
		}

		return desc ? -result : result;
	});
}

export { getPlural, getProperty, hex2Rgba, is, isDeepEqual, rgba2Hex, setProperty, sortArray };
