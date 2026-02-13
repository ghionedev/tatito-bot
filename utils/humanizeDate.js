const MONTHS = [
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

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

function parseIsoDate(date) {
  return new Date(`${date}T00:00:00`);
}

function formatDayMonth(dateObj) {
  return `${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`;
}

function startOfDay(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}

export function humanizeDate(date) {
  const target = parseIsoDate(date);
  const today = startOfDay(new Date());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfDay(target) - today) / oneDayMs);
  const short = formatDayMonth(target);

  let label;
  if (diffDays === 0) {
    label = "hoy";
  } else if (diffDays === 1) {
    label = "mañana";
  } else if (diffDays === 2) {
    label = "pasado mañana";
  } else if (diffDays >= 3 && diffDays <= 7) {
    label = WEEKDAYS[target.getDay()];
  } else {
    label = short;
  }

  return { label, short };
}