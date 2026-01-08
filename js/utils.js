export const PAGE_SIZE = 5;

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDateRu(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
}

export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}


export function pushAlert(containerEl, { type = "success", title = "", message = "" }) {
  const id = `a_${crypto.randomUUID()}`;
  const html = `
    <div id="${id}" class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${title ? `<strong>${escapeHtml(title)}</strong> ` : ""}
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  containerEl.insertAdjacentHTML("afterbegin", html);
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) bootstrap.Alert.getOrCreateInstance(el).close();
  }, 5000);
}

export function paginate(items, page, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const sliced = items.slice(start, start + pageSize);
  return { page: safePage, totalPages, sliced };
}

export function renderPagination(ulEl, { page, totalPages, onPage }) {
  ulEl.innerHTML = "";

  const mk = (label, p, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}`.trim();
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (!disabled) onPage(p);
    });
    li.appendChild(a);
    return li;
  };

  ulEl.appendChild(mk("«", page - 1, page <= 1));

  // пагинация
  const windowSize = 2;
  const start = Math.max(1, page - windowSize);
  const end = Math.min(totalPages, page + windowSize);

  if (start > 1) ulEl.appendChild(mk("1", 1, false, page === 1));
  if (start > 2) {
    const li = document.createElement("li");
    li.className = "page-item disabled";
    li.innerHTML = `<span class="page-link">…</span>`;
    ulEl.appendChild(li);
  }

  for (let p = start; p <= end; p += 1) ulEl.appendChild(mk(String(p), p, false, p === page));

  if (end < totalPages - 1) {
    const li = document.createElement("li");
    li.className = "page-item disabled";
    li.innerHTML = `<span class="page-link">…</span>`;
    ulEl.appendChild(li);
  }
  if (end < totalPages) ulEl.appendChild(mk(String(totalPages), totalPages, false, page === totalPages));

  ulEl.appendChild(mk("»", page + 1, page >= totalPages));
}
