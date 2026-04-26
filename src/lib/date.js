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

export function format(date, fmt) {
  const d = toDate(date);
  if (!isValid(d)) return '';
  return fmt.replace(/yyyy|MMMM|MMM|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a/g, (token) => {
    return String(FORMATTERS[token](d));
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

  const clean = str.toLowerCase().replace(/,/g, '').trim();

  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(clean)) {
    const [a, b, c] = clean.split(/[-/]/).map(Number);

    if (a > 31) {
      return buildDate(a, b - 1, c);
    }

    if (c > 31) {
      if (a > 12) return buildDate(c, b - 1, a);
      return buildDate(c, a - 1, b);
    }
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
    const day = date.getDay(); // Sunday start
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
  const diffMs = Math.abs(toDate(a) - toDate(b));

  const fn = mode === 'exact' ? Math.floor : Math.round;

  const seconds = fn(diffMs / 1000);
  if (seconds < 60) return compact ? `${seconds}s` : `${seconds} seconds`;

  const minutes = fn(seconds / 60);
  if (minutes < 60) return compact ? `${minutes}m` : `${minutes} minutes`;

  const hours = fn(minutes / 60);
  if (hours < 24) return compact ? `${hours}h` : `${hours} hours`;

  const days = fn(hours / 24);
  if (days < 30) return compact ? `${days}d` : `${days} days`;

  const months = fn(days / 30);
  if (months < 12) return compact ? `${months}mo` : `${months} months`;

  const years = fn(months / 12);
  return compact ? `${years}y` : `${years} years`;
}
