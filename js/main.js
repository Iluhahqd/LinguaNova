import { api } from "./api.js";
import { debounce, escapeHtml, paginate, renderPagination, pushAlert, PAGE_SIZE } from "./utils.js";
import { calcCoursePrice, applyAutoOptions, computeCourseHours } from "./pricing.js";

const els = {
  alerts: document.getElementById("alerts"),

  coursesTbody: document.getElementById("coursesTbody"),
  coursesPagination: document.getElementById("coursesPagination"),
  courseSearchName: document.getElementById("courseSearchName"),
  courseSearchLevel: document.getElementById("courseSearchLevel"),
  courseSearchReset: document.getElementById("courseSearchReset"),

  tutorsTbody: document.getElementById("tutorsTbody"),
  tutorSearchLevel: document.getElementById("tutorSearchLevel"),
  tutorSearchExp: document.getElementById("tutorSearchExp"),
  tutorSearchReset: document.getElementById("tutorSearchReset"),

  orderModal: document.getElementById("orderModal"),
  orderForm: document.getElementById("orderForm"),
  orderModalTitle: document.getElementById("orderModalTitle"),
  orderSubmitBtn: document.getElementById("orderSubmitBtn"),

  orderMode: document.getElementById("orderMode"),
  orderId: document.getElementById("orderId"),
  orderCourseId: document.getElementById("orderCourseId"),
  orderTutorId: document.getElementById("orderTutorId"),

  orderCourseName: document.getElementById("orderCourseName"),
  orderTeacher: document.getElementById("orderTeacher"),
  orderDateStart: document.getElementById("orderDateStart"),
  orderTimeStart: document.getElementById("orderTimeStart"),
  orderDurationInfo: document.getElementById("orderDurationInfo"),
  orderPersons: document.getElementById("orderPersons"),
  orderPrice: document.getElementById("orderPrice"),

  optSupplementary: document.getElementById("optSupplementary"),
  optPersonalized: document.getElementById("optPersonalized"),
  optExcursions: document.getElementById("optExcursions"),
  optAssessment: document.getElementById("optAssessment"),
  optInteractive: document.getElementById("optInteractive"),

  autoEarly: document.getElementById("autoEarly"),
  autoGroup: document.getElementById("autoGroup"),
  autoIntensive: document.getElementById("autoIntensive"),
};

let courses = [];
let tutors = [];
let coursesPage = 1;

let selectedCourse = null;
let selectedTutorId = 0;
let orderModalInstance = null;

function showError(err) {
  pushAlert(els.alerts, { type: "danger", title: "Ошибка:", message: err.message || String(err) });
}

function showSuccess(msg) {
  pushAlert(els.alerts, { type: "success", title: "Готово:", message: msg });
}

function normalizeLevel(v) {
  return String(v ?? "").trim();
}

function filterCourses() {
  const name = els.courseSearchName.value.trim().toLowerCase();
  const level = normalizeLevel(els.courseSearchLevel.value);

  return courses.filter((c) => {
    const okName = !name || String(c.name).toLowerCase().includes(name);
    const okLevel = !level || normalizeLevel(c.level) === level;
    return okName && okLevel;
  });
}

function renderCourses() {
  const items = filterCourses();
  const { page, totalPages, sliced } = paginate(items, coursesPage, PAGE_SIZE);
  coursesPage = page;

  els.coursesTbody.innerHTML = sliced.map((c) => `
    <tr>
      <td>
        <div class="fw-semibold">${escapeHtml(c.name)}</div>
        <div class="text-muted small text-truncate" style="max-width:420px" title="${escapeHtml(c.description)}">
          ${escapeHtml(c.description)}
        </div>
      </td>
      <td>${escapeHtml(c.level)}</td>
      <td class="d-none d-md-table-cell">${escapeHtml(c.teacher)}</td>
      <td>${escapeHtml(c.total_length)} нед / ${escapeHtml(c.week_length)} ч/нед</td>
      <td>${escapeHtml(c.course_fee_per_hour)} ₽</td>
      <td class="text-end">
        <button class="btn btn-sm btn-primary" data-action="apply" data-course-id="${c.id}">
          Подать заявку
        </button>
      </td>
    </tr>
  `).join("");

  renderPagination(els.coursesPagination, {
    page,
    totalPages,
    onPage: (p) => {
      coursesPage = p;
      renderCourses();
    },
  });
}

function filterTutors() {
  const level = normalizeLevel(els.tutorSearchLevel.value);
  const minExp = els.tutorSearchExp.value ? Number(els.tutorSearchExp.value) : null;

  return tutors.filter((t) => {
    const okLevel = !level || normalizeLevel(t.language_level) === level;
    const okExp = minExp === null || Number(t.work_experience) >= minExp;
    return okLevel && okExp;
  });
}

function renderTutors() {
  const items = filterTutors();
  els.tutorsTbody.innerHTML = items.map((t) => `
    <tr class="${Number(t.id) === Number(selectedTutorId) ? "tutor-row-selected" : ""}">
      <td>
        <div class="d-flex align-items-center gap-2">
          <div>
            <div class="fw-semibold">${escapeHtml(t.name)}</div>
            <div class="text-muted small">Говорит: ${escapeHtml((t.languages_spoken || []).join(", "))}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(t.language_level)}</td>
      <td class="d-none d-md-table-cell">${escapeHtml((t.languages_offered || []).join(", "))}</td>
      <td>${escapeHtml(t.work_experience)} лет</td>
      <td>${escapeHtml(t.price_per_hour)} ₽</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-action="select-tutor" data-tutor-id="${t.id}">
          Выбрать
        </button>
      </td>
    </tr>
  `).join("");
}

function formatCourseDurationInfo(course, dateStartYmd) {
  const weeks = Number(course.total_length);
  const start = new Date(`${dateStartYmd}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);

  const pad = (n) => String(n).padStart(2, "0");
  const endYmd = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

  return `${weeks} недель • Последнее занятие примерно: ${endYmd}`;
}

function splitStartDates(course) {
  // Нам нужно- дата + возможные времена в эту дату
  const map = new Map();
  (course.start_dates || []).forEach((iso) => {
    const ymd = String(iso).slice(0, 10);
    const time = String(iso).slice(11, 16);
    if (!map.has(ymd)) map.set(ymd, new Set());
    map.get(ymd).add(time);
  });

  const dates = Array.from(map.keys()).sort();
  const timesByDate = {};
  dates.forEach((d) => {
    timesByDate[d] = Array.from(map.get(d)).sort();
  });
  return { dates, timesByDate };
}

function getOptionsForPrice({ course, dateStartYmd, persons }) {
  const auto = applyAutoOptions({ course, dateStartYmd, persons });
  const user = {
    supplementary: els.optSupplementary.checked,
    personalized: els.optPersonalized.checked,
    excursions: els.optExcursions.checked,
    assessment: els.optAssessment.checked,
    interactive: els.optInteractive.checked,
  };

  return {
    early_registration: auto.early_registration,
    group_enrollment: auto.group_enrollment,
    intensive_course: auto.intensive_course,
    ...user,
  };
}

function renderAutoBadges(auto) {
  els.autoEarly.style.display = auto.early_registration ? "inline-block" : "none";
  els.autoGroup.style.display = auto.group_enrollment ? "inline-block" : "none";
  els.autoIntensive.style.display = auto.intensive_course ? "inline-block" : "none";
}

function updatePricePreview() {
  if (!selectedCourse) return;
  const dateStartYmd = els.orderDateStart.value;
  const timeStart = els.orderTimeStart.value;
  const persons = Number(els.orderPersons.value || 1);

  if (!dateStartYmd || !timeStart || !persons) {
    els.orderPrice.value = "";
    return;
  }

  const auto = applyAutoOptions({ course: selectedCourse, dateStartYmd, persons });
  renderAutoBadges(auto);

  const options = getOptionsForPrice({ course: selectedCourse, dateStartYmd, persons });

  const price = calcCoursePrice({
    course: selectedCourse,
    dateStartYmd,
    timeStartHHMM: timeStart,
    persons,
    options,
  });

  els.orderPrice.value = `${price} ₽`;
}

function openCreateOrderModal(course) {
  selectedCourse = course;
  selectedTutorId = 0;

  els.orderMode.value = "create";
  els.orderId.value = "";
  els.orderCourseId.value = String(course.id);
  els.orderTutorId.value = "0";

  els.orderModalTitle.textContent = "Оформление заявки";
  els.orderSubmitBtn.textContent = "Отправить";

  els.orderCourseName.value = course.name;
  els.orderTeacher.value = course.teacher;

  // дата
  const { dates, timesByDate } = splitStartDates(course);
  els.orderDateStart.innerHTML = dates.map((d) => `<option value="${d}">${d}</option>`).join("");
  els.orderTimeStart.innerHTML = "";
  els.orderTimeStart.disabled = true;

  els.orderPersons.value = "1";
  els.optSupplementary.checked = false;
  els.optPersonalized.checked = false;
  els.optExcursions.checked = false;
  els.optAssessment.checked = false;
  els.optInteractive.checked = false;

  // продолжительность
  const hours = computeCourseHours(course);
  els.orderDurationInfo.value = `${course.total_length} недель • ${hours} часов всего`;

  els.orderDateStart.onchange = () => {
    const ymd = els.orderDateStart.value;
    const times = timesByDate[ymd] || [];

    els.orderTimeStart.disabled = times.length === 0;
    els.orderTimeStart.innerHTML = times.map((t) => {
      const [h, m] = t.split(":").map(Number);
      const endH = h + Number(course.week_length);
      const end = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return `<option value="${t}">${t} – ${end}</option>`;
    }).join("");

    els.orderDurationInfo.value = formatCourseDurationInfo(course, ymd);
    updatePricePreview();
  };

  els.orderTimeStart.onchange = updatePricePreview;
  els.orderPersons.oninput = updatePricePreview;

  const optInputs = [
    els.optSupplementary,
    els.optPersonalized,
    els.optExcursions,
    els.optAssessment,
    els.optInteractive,
  ];
  optInputs.forEach((i) => i.onchange = updatePricePreview);


  if (dates.length) {
    els.orderDateStart.value = dates[0];
    els.orderDateStart.onchange();
  }

  if (!orderModalInstance) orderModalInstance = new bootstrap.Modal(els.orderModal);
  orderModalInstance.show();
}

async function submitOrder(e) {
  e.preventDefault();
  if (!selectedCourse) return;

  const courseId = Number(els.orderCourseId.value);
  const tutorId = Number(els.orderTutorId.value || 0);

  const dateStart = els.orderDateStart.value;
  const timeStart = els.orderTimeStart.value;
  const persons = Number(els.orderPersons.value);

  const auto = applyAutoOptions({ course: selectedCourse, dateStartYmd: dateStart, persons });
  const options = getOptionsForPrice({ course: selectedCourse, dateStartYmd: dateStart, persons });

  const price = calcCoursePrice({
    course: selectedCourse,
    dateStartYmd: dateStart,
    timeStartHHMM: timeStart,
    persons,
    options,
  });

  const payload = {
    tutor_id: tutorId,
    course_id: courseId,
    date_start: dateStart,
    time_start: timeStart,
    duration: computeCourseHours(selectedCourse),
    persons,
    price,
    early_registration: auto.early_registration,
    group_enrollment: auto.group_enrollment,
    intensive_course: auto.intensive_course,
    supplementary: options.supplementary,
    personalized: options.personalized,
    excursions: options.excursions,
    assessment: options.assessment,
    interactive: options.interactive,
  };

  try {
    await api.createOrder(payload);
    showSuccess("Заявка успешно отправлена");
    orderModalInstance?.hide();
  } catch (err) {
    showError(err);
  }
}

async function init() {
  try {
    [courses, tutors] = await Promise.all([api.getCourses(), api.getTutors()]);
    renderCourses();
    renderTutors();
  } catch (err) {
    showError(err);
  }
}

els.courseSearchReset.addEventListener("click", () => {
  els.courseSearchName.value = "";
  els.courseSearchLevel.value = "";
  coursesPage = 1;
  renderCourses();
});

const rerenderCoursesDebounced = debounce(() => {
  coursesPage = 1;
  renderCourses();
}, 200);

els.courseSearchName.addEventListener("input", rerenderCoursesDebounced);
els.courseSearchLevel.addEventListener("change", rerenderCoursesDebounced);

els.tutorSearchReset.addEventListener("click", () => {
  els.tutorSearchLevel.value = "";
  els.tutorSearchExp.value = "";
  selectedTutorId = 0;
  renderTutors();
});

const rerenderTutorsDebounced = debounce(() => renderTutors(), 200);
els.tutorSearchLevel.addEventListener("change", rerenderTutorsDebounced);
els.tutorSearchExp.addEventListener("input", rerenderTutorsDebounced);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "apply") {
    const id = Number(btn.dataset.courseId);
    const course = courses.find((c) => Number(c.id) === id);
    if (course) openCreateOrderModal(course);
  }

  if (action === "select-tutor") {
    selectedTutorId = Number(btn.dataset.tutorId);
    renderTutors();
    pushAlert(els.alerts, { type: "info", title: "Выбор:", message: "Репетитор выделен. Заявку можно оформить через курс." });
  }
});

els.orderForm.addEventListener("submit", submitOrder);

init();
