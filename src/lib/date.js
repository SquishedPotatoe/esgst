function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  return new Date(input);
}

export function isValid(date) {
  const d = toDate(date);
  return !Number.isNaN(d.getTime());
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FORMATTERS = {
  yyyy: (d) => d.getFullYear(),
  MMMM: (d) => MONTHS_LONG[d.getMonth()],
  MMM: (d) => MONTHS_SHORT[d.getMonth()],
  MM: (d) => String(d.getMonth() + 1).padStart(2, '0'),
  M: (d) => d.getMonth() + 1,
  dd: (d) => String(d.getDate()).padStart(2, '0'),
  d: (d) => d.getDate(),
  HH: (d) => String(d.getHours()).padStart(2, '0'),
  H: (d) => d.getHours(),
  hh: (d) => String(d.getHours() % 12 || 12).padStart(2, '0'),
  h: (d) => d.getHours() % 12 || 12,
  mm: (d) => String(d.getMinutes()).padStart(2, '0'),
  m: (d) => d.getMinutes(),
  ss: (d) => String(d.getSeconds()).padStart(2, '0'),
  s: (d) => d.getSeconds(),
  a: (d) => d.getHours() >= 12 ? 'PM' : 'AM',
};

function buildDate(year, month, day = 1) {
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return new Date(NaN);
  }

  return date;
}

export function format(date, fmt, now = new Date()) {
  const d = toDate(date);
  if (!isValid(d)) return '';

  const refDate = toDate(now);
  const isSameCalendarDay = isSameDay(d, refDate);
  const isNotCurrentYear = d.getFullYear() !== refDate.getFullYear();
  const hasNonZeroSeconds = d.getSeconds() !== 0;

  let processedFmt = fmt.replace(/(DM|[YS])\{([^}]*)\}/g, (match, type, content) => {
    switch (type) {
      case 'DM': return isSameCalendarDay ? '' : content;
      case 'Y': return isNotCurrentYear ? content : '';
      case 'S': return hasNonZeroSeconds ? content : '';
      default: return '';
    }
  });

  const TOKEN_OR_LITERAL_REGEX = /\[([^\]]+)\]|yyyy|MMMM|MMM|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a/g;

  return processedFmt.replace(TOKEN_OR_LITERAL_REGEX, (match, literal) => {
    if (literal) return literal;
    const formatter = FORMATTERS[match];
    return formatter ? String(formatter(d)) : match;
  });
}

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parse(str) {
  if (!str) return new Date(NaN);

  const clean = String(str).toLowerCase().replace(/,/g, '').trim();
  if (/^\d{4}$/.test(clean)) {
    return buildDate(Number(clean), 0, 1);
  }

  if (/^\d{1,4}[-/]\d{1,2}([-/]\d{1,4})?$/.test(clean)) {
    const parts = clean.split(/[-/]/).map(Number);
    const currentYear = new Date().getFullYear();

    if (parts.length === 2) {
      const [a, b] = parts;
      if (a >= 1000) return buildDate(a, b - 1, 1);
      if (a > 12) return buildDate(currentYear, b - 1, a);
      return buildDate(currentYear, a - 1, b);
    }

    const [a, b, c] = parts;
    if (a > 31) return buildDate(a, b - 1, c);
    if (c > 31) {
      if (a > 12) return buildDate(c, b - 1, a);
      return buildDate(c, a - 1, b);
    }

    const fullYear = c < 100 ? 2000 + c : c;
    return buildDate(fullYear, a - 1, b);
  }

  const parts = clean.split(/\s+/);

  let day, month, year;

  for (const part of parts) {
    if (MONTHS[part] !== undefined) {
      month = MONTHS[part];
    } else if (/^\d{4}$/.test(part)) {
      year = Number(part);
    } else if (/^\d{1,2}$/.test(part)) {
      if (!day) day = Number(part);
    }
  }

  if (!year) year = new Date().getFullYear();

  if (month !== undefined && day) {
    return buildDate(year, month, day);
  }

  if (month !== undefined && year && !day) {
    return buildDate(year, month, 1);
  }

  return new Date(NaN);
}

export function isSameDay(a, b) {
  const d1 = toDate(a);
  const d2 = toDate(b);
  if (!isValid(d1) || !isValid(d2)) return false;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isSameYear(a, b) {
  return toDate(a).getFullYear() === toDate(b).getFullYear();
}

export function isSameWeek(a, b) {
  const startOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  return startOfWeek(toDate(a)) === startOfWeek(toDate(b));
}

export function differenceInHours(a, b) {
  return Math.floor((toDate(a) - toDate(b)) / 3600000);
}

export function differenceInDays(a, b) {
  return Math.floor((toDate(a) - toDate(b)) / 86400000);
}

export function formatDistanceStrict(a, b, { compact = false, mode = 'approx' } = {}) {
  const da = toDate(a);
  const db = toDate(b);
  if (!isValid(da) || !isValid(db)) return '';

  const diffMs = Math.abs(da - db);
  const fn = mode === 'exact' ? Math.floor : Math.round;
  const formatUnit = (val, singular, plural, compactSuffix) => {
    if (compact) return `${val}${compactSuffix}`;
    return `${val} ${val === 1 ? singular : plural}`;
  };

  const seconds = fn(diffMs / 1000);
  if (seconds < 60) { return formatUnit(seconds, 'second', 'seconds', 's'); }

  const minutes = fn(diffMs / (1000 * 60));
  if (minutes < 60) { return formatUnit(minutes, 'minute', 'minutes', 'm'); }

  const hours = fn(diffMs / (1000 * 60 * 60));
  if (hours < 24) { return formatUnit(hours, 'hour', 'hours', 'h'); }

  const days = fn(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) { return formatUnit(days, 'day', 'days', 'd'); }

  const months = fn(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
  if (months < 12) { return formatUnit(months, 'month', 'months', 'mo'); }

  const years = fn(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return formatUnit(years, 'year', 'years', 'y');
}
