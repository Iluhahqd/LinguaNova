
export function computeCourseHours(course) {

  return Number(course.total_length) * Number(course.week_length);
}

export function parseStartDateTime(dateIsoOrYmd, timeHHMM) {
  const ymd = String(dateIsoOrYmd).slice(0, 10);
  return new Date(`${ymd}T${timeHHMM}:00`);
}

export function isWeekend(d) {
  const day = d.getDay(); // 0=Sun,6=Sat
  return day === 0 || day === 6;
}

export function morningSurcharge(timeHHMM) {
  const [h, m] = timeHHMM.split(":").map(Number);
  const minutes = h * 60 + m;
  const from = 9 * 60;
  const to = 12 * 60;
  return minutes >= from && minutes <= to ? 400 : 0;
}

export function eveningSurcharge(timeHHMM) {
  const [h, m] = timeHHMM.split(":").map(Number);
  const minutes = h * 60 + m;
  const from = 18 * 60;
  const to = 20 * 60;
  return minutes >= from && minutes <= to ? 1000 : 0;
}

export function calcCoursePrice({
  course,
  dateStartYmd,
  timeStartHHMM,
  persons,
  options,
}) {
  const durationInHours = computeCourseHours(course);
  const multiplier = isWeekend(parseStartDateTime(dateStartYmd, timeStartHHMM)) ? 1.5 : 1;

  const base =
    (Number(course.course_fee_per_hour) * durationInHours * multiplier) +
    morningSurcharge(timeStartHHMM) +
    eveningSurcharge(timeStartHHMM);

  let total = base * Number(persons);

  if (options.early_registration) total *= 0.9;
  if (options.group_enrollment) total *= 0.85;

  if (options.intensive_course) total *= 1.2;

  if (options.supplementary) total += 2000 * Number(persons);

  if (options.personalized) total += 1500 * Number(course.total_length);

  if (options.excursions) total *= 1.25;


  if (options.assessment) total += 300;

  if (options.interactive) total *= 1.5;

  return Math.round(total);
}

export function applyAutoOptions({ course, dateStartYmd, persons }) {
  const now = new Date();
  const start = new Date(`${dateStartYmd}T00:00:00`);
  const diffDays = Math.floor((start - now) / (1000 * 60 * 60 * 24));

  return {
    early_registration: diffDays >= 30,
    group_enrollment: Number(persons) >= 5,
    intensive_course: Number(course.week_length) >= 5,
  };
}
