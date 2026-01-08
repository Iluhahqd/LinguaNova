import { api } from "./api.js";
import { escapeHtml, paginate, renderPagination, pushAlert, formatDateRu, PAGE_SIZE } from "./utils.js";
import { calcCoursePrice, computeCourseHours } from "./pricing.js";

const els = {
  alerts: document.getElementById("alerts"),
  ordersTbody: document.getElementById("ordersTbody"),
  ordersPagination: document.getElementById("ordersPagination"),

  detailsModal: document.getElementById("detailsModal"),
  detailsBody: document.getElementById("detailsBody"),

  orderModal: document.getElementById("orderModal"),
  orderForm: document.getElementById("orderForm"),
  orderModalTitle: document.getElementById("orderModalTitle"),
  orderSubmitBtn: document.getElementById("orderSubmitBtn"),

  orderId: document.getElementById("orderId"),
  orderCourseId: document.getElementById("orderCourseId"),
  orderTutorId: document.getElementById("orderTutorId"),

  orderCourseName: document.getElementById("orderCourseName"),
  orderTeacher: document.getElementById("orderTeacher"),
  orderDateStart: document.getElementById("orderDateStart"),
  orderTimeStart: document.getElementById("orderTimeStart"),
  orderPersons: document.getElementById("orderPersons"),
  orderPrice: document.getElementById("orderPrice"),

  optEarly: document.getElementById("optEarly"),
  optGroup: document.getElementById("optGroup"),
  optIntensive: document.getElementById("optIntensive"),
  optSupplementary: document.getElementById("optSupplementary"),
  optPersonalized: document.getElementById("optPersonalized"),
  optExcursions: document.getElementById("optExcursions"),
  optAssessment: document.getElementById("optAssessment"),
  optInteractive: document.getElementById("optInteractive"),

  deleteModal: document.getElementById("deleteModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
};

let orders = [];
let courses = [];
let ordersPage = 1;

let detailsModalInstance = null;
let orderModalInstance = null;
let deleteModalInstance = null;

let deleteId = null;

function showError(err) {
  pushAlert(els.alerts, { type: "danger", title: "Ошибка:", message: err.message || String(err) });
}
function showSuccess(msg) {
  pushAlert(els.alerts, { type: "success", title: "Готово:", message: msg });
}

function courseById(id) {
  return courses.find((c) => Number(c.id) === Number(id)) || null;
}

function renderOrders() {
  const { page, totalPages, sliced } = paginate(orders, ordersPage, PAGE_SIZE);
  ordersPage = page;

  els.ordersTbody.innerHTML = sliced.map((o, idx) => {
    const c = courseById(o.course_id);
    const name = c ? c.name : `course_id=${o.course_id}`;
    return `
      <tr>
        <td>${(page - 1) * PAGE_SIZE + idx + 1}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(formatDateRu(o.date_start))} ${escapeHtml(o.time_start)}</td>
        <td class="fw-semibold">${escapeHtml(o.price)} ₽</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-action="details" data-id="${o.id}">Подробнее</button>
          <button class="btn btn-sm btn-primary" data-action="edit" data-id="${o.id}">Изменить</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${o.id}">Удалить</button>
        </td>
      </tr>
    `;
  }).join("");

  renderPagination(els.ordersPagination, {
    page,
    totalPages,
    onPage: (p) => {
      ordersPage = p;
      renderOrders();
    },
  });
}

function optionsFromOrder(o) {
  return {
    early_registration: Boolean(o.early_registration),
    group_enrollment: Boolean(o.group_enrollment),
    intensive_course: Boolean(o.intensive_course),
    supplementary: Boolean(o.supplementary),
    personalized: Boolean(o.personalized),
    excursions: Boolean(o.excursions),
    assessment: Boolean(o.assessment),
    interactive: Boolean(o.interactive),
  };
}

function optionsFromForm() {
  return {
    early_registration: els.optEarly.checked,
    group_enrollment: els.optGroup.checked,
    intensive_course: els.optIntensive.checked,
    supplementary: els.optSupplementary.checked,
    personalized: els.optPersonalized.checked,
    excursions: els.optExcursions.checked,
    assessment: els.optAssessment.checked,
    interactive: els.optInteractive.checked,
  };
}

function updatePricePreview() {
  const courseId = Number(els.orderCourseId.value);
  const course = courseById(courseId);
  if (!course) return;

  const dateStart = els.orderDateStart.value;
  const timeStart = String(els.orderTimeStart.value).slice(0, 5);
  const persons = Number(els.orderPersons.value || 1);

  if (!dateStart || !timeStart || !persons) {
    els.orderPrice.value = "";
    return;
  }

  const options = optionsFromForm();
  const price = calcCoursePrice({
    course,
    dateStartYmd: dateStart,
    timeStartHHMM: timeStart,
    persons,
    options,
  });

  els.orderPrice.value = `${price} ₽`;
}

async function openDetails(id) {
  try {
    const o = await api.getOrder(id);
    const c = courseById(o.course_id);

    const opts = optionsFromOrder(o);
    const applied = Object.entries(opts)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "нет";

    els.detailsBody.innerHTML = `
      <div class="mb-2"><strong>Заявка #${escapeHtml(o.id)}</strong></div>
      <div class="mb-1"><strong>Курс:</strong> ${escapeHtml(c ? c.name : o.course_id)}</div>
      <div class="mb-1"><strong>Дата/время:</strong> ${escapeHtml(o.date_start)} ${escapeHtml(o.time_start)}</div>
      <div class="mb-1"><strong>Студентов:</strong> ${escapeHtml(o.persons)}</div>
      <div class="mb-1"><strong>Стоимость:</strong> ${escapeHtml(o.price)} ₽</div>
      <hr>
      <div class="mb-1"><strong>Опции/скидки/надбавки:</strong> ${escapeHtml(applied)}</div>
      <div class="text-muted small">Отображаем рассчитанные скидки/надбавки . </div>
    `;

    if (!detailsModalInstance) detailsModalInstance = new bootstrap.Modal(els.detailsModal);
    detailsModalInstance.show();
  } catch (err) {
    showError(err);
  }
}

function fillEditForm(order) {
  const c = courseById(order.course_id);

  els.orderId.value = String(order.id);
  els.orderCourseId.value = String(order.course_id);
  els.orderTutorId.value = String(order.tutor_id || 0);

  els.orderCourseName.value = c ? c.name : `course_id=${order.course_id}`;
  els.orderTeacher.value = c ? c.teacher : "-";

  els.orderDateStart.value = order.date_start;
  els.orderTimeStart.value = String(order.time_start).slice(0, 5);

  els.orderPersons.value = String(order.persons);

  els.optEarly.checked = Boolean(order.early_registration);
  els.optGroup.checked = Boolean(order.group_enrollment);
  els.optIntensive.checked = Boolean(order.intensive_course);
  els.optSupplementary.checked = Boolean(order.supplementary);
  els.optPersonalized.checked = Boolean(order.personalized);
  els.optExcursions.checked = Boolean(order.excursions);
  els.optAssessment.checked = Boolean(order.assessment);
  els.optInteractive.checked = Boolean(order.interactive);

  updatePricePreview();
}

async function openEdit(id) {
  try {
    const o = await api.getOrder(id);
    els.orderModalTitle.textContent = "Редактирование заявки";
    els.orderSubmitBtn.textContent = "Сохранить";
    fillEditForm(o);

    if (!orderModalInstance) orderModalInstance = new bootstrap.Modal(els.orderModal);
    orderModalInstance.show();
  } catch (err) {
    showError(err);
  }
}

async function submitEdit(e) {
  e.preventDefault();

  const id = Number(els.orderId.value);
  const courseId = Number(els.orderCourseId.value);
  const course = courseById(courseId);

  const dateStart = els.orderDateStart.value;
  const timeStart = String(els.orderTimeStart.value).slice(0, 5);
  const persons = Number(els.orderPersons.value);

  if (!course) {
    showError(new Error("Не удалось определить курс для пересчёта цены"));
    return;
  }

  const options = optionsFromForm();
  const price = calcCoursePrice({
    course,
    dateStartYmd: dateStart,
    timeStartHHMM: timeStart,
    persons,
    options,
  });

  const payload = {
    course_id: courseId,
    tutor_id: Number(els.orderTutorId.value || 0),
    date_start: dateStart,
    time_start: timeStart,
    duration: computeCourseHours(course),
    persons,
    price,
    ...options,
  };

  try {
    const updated = await api.updateOrder(id, payload);
    // обновим локально
    orders = orders.map((o) => (Number(o.id) === Number(id) ? updated : o));
    renderOrders();
    showSuccess("Заявка обновлена");
    orderModalInstance?.hide();
  } catch (err) {
    showError(err);
  }
}

function openDelete(id) {
  deleteId = Number(id);
  if (!deleteModalInstance) deleteModalInstance = new bootstrap.Modal(els.deleteModal);
  deleteModalInstance.show();
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    await api.deleteOrder(deleteId); // DELETE
    orders = orders.filter((o) => Number(o.id) !== Number(deleteId));
    renderOrders();
    showSuccess("Заявка удалена");
    deleteModalInstance?.hide();
  } catch (err) {
    showError(err);
  } finally {
    deleteId = null;
  }
}

async function init() {
  try {
    // грузим курсы для отображения названий в заявках
    [courses, orders] = await Promise.all([api.getCourses(), api.getOrders()]);
    renderOrders();
  } catch (err) {
    showError(err);
  }
}

// слушатели
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "details") openDetails(id);
  if (action === "edit") openEdit(id);
  if (action === "delete") openDelete(id);
});

els.confirmDeleteBtn.addEventListener("click", confirmDelete);

els.orderForm.addEventListener("submit", submitEdit);

// чтобы цена обновлялась при изменениях
[
  els.orderDateStart,
  els.orderTimeStart,
  els.orderPersons,
  els.optEarly,
  els.optGroup,
  els.optIntensive,
  els.optSupplementary,
  els.optPersonalized,
  els.optExcursions,
  els.optAssessment,
  els.optInteractive,
].forEach((el) => {
  el.addEventListener("change", updatePricePreview);
  el.addEventListener("input", updatePricePreview);
});

init();
