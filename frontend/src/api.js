const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

async function request(path, options = {}) {
  const config = {
    method: "GET",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };

  if (config.body && !(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export const api = {
  getDashboard() {
    return request("/dashboard/");
  },
  getProducts() {
    return request("/products/");
  },
  createProduct(payload) {
    return request("/products/", { method: "POST", body: payload });
  },
  getPurchases() {
    return request("/purchases/");
  },
  createPurchase(formData) {
    return request("/purchases/", { method: "POST", body: formData });
  },
  updatePurchaseStatus(id, status) {
    return request(`/purchases/${id}/`, {
      method: "PATCH",
      body: { status },
    });
  },
  getSales() {
    return request("/sales/");
  },
  createSale(formData) {
    return request("/sales/", { method: "POST", body: formData });
  },
  askChat(question) {
    return request("/chat/", { method: "POST", body: { question } });
  },
};
