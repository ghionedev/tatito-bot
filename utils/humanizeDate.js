const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export function humanizeDate(isoDate, todayIso) {
  const target = parseIsoDate(isoDate);
  const today = parseIsoDate(todayIso);

  if (!target || !today) {
    return { label: null, short: null };
  }

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const short = `${target.getDate()} ${MONTHS_SHORT[target.getMonth()]}`;

  if (diffDays === 0) return { label: "hoy", short };
  if (diffDays === 1) return { label: "manana", short };
  if (diffDays === 2) return { label: "pasado manana", short };

  if (diffDays > 2 && diffDays < 7) {
    return { label: WEEKDAYS[target.getDay()], short };
  }

  return {
    label: `${target.getDate()} de ${MONTHS_LONG[target.getMonth()]}`,
    short,
  };
}

function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const result = new Date(year, month - 1, day);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }

  result.setHours(0, 0, 0, 0);
  return result;
}
