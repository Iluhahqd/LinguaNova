import { API_BASE, API_KEY } from "./config.js";


export async function apiRequest(path, { method = "GET", body = null } = {}) {
  const url = new URL(API_BASE + path);
  url.searchParams.set("api_key", API_KEY);

  const options = { method, headers: {} };
  if (body !== null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `API error: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  getCourses: () => apiRequest("/api/courses"),
  getTutors: () => apiRequest("/api/tutors"),
  getOrders: () => apiRequest("/api/orders"),
  getOrder: (id) => apiRequest(`/api/orders/${id}`),
  createOrder: (payload) => apiRequest("/api/orders", { method: "POST", body: payload }),
  updateOrder: (id, payload) => apiRequest(`/api/orders/${id}`, { method: "PUT", body: payload }),
  deleteOrder: (id) => apiRequest(`/api/orders/${id}`, { method: "DELETE" }),
};
