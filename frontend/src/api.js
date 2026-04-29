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
  getSuppliers() {
    return request("/suppliers/");
  },
  createSupplier(payload) {
    return request("/suppliers/", { method: "POST", body: payload });
  },
  updateSupplier(id, payload) {
    return request(`/suppliers/${id}/`, { method: "PATCH", body: payload });
  },
  deleteSupplier(id) {
    return request(`/suppliers/${id}/`, { method: "DELETE" });
  },
  getCustomers() {
    return request("/customers/");
  },
  createCustomer(payload) {
    return request("/customers/", { method: "POST", body: payload });
  },
  updateCustomer(id, payload) {
    return request(`/customers/${id}/`, { method: "PATCH", body: payload });
  },
  deleteCustomer(id) {
    return request(`/customers/${id}/`, { method: "DELETE" });
  },
  getCategories() {
    return request("/categories/");
  },
  createCategory(payload) {
    return request("/categories/", { method: "POST", body: payload });
  },
  updateCategory(id, payload) {
    return request(`/categories/${id}/`, { method: "PATCH", body: payload });
  },
  deleteCategory(id) {
    return request(`/categories/${id}/`, { method: "DELETE" });
  },
  getProducts() {
    return request("/products/");
  },
  createProduct(payload) {
    return request("/products/", { method: "POST", body: payload });
  },
  updateProduct(id, payload) {
    return request(`/products/${id}/`, { method: "PATCH", body: payload });
  },
  deleteProduct(id) {
    return request(`/products/${id}/`, { method: "DELETE" });
  },
  getPurchases() {
    return request("/purchases/");
  },
  createPurchase(formData) {
    return request("/purchases/", { method: "POST", body: formData });
  },
  updatePurchase(id, payload) {
    return request(`/purchases/${id}/`, { method: "PATCH", body: payload });
  },
  deletePurchase(id) {
    return request(`/purchases/${id}/`, { method: "DELETE" });
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
  updateSale(id, payload) {
    return request(`/sales/${id}/`, { method: "PATCH", body: payload });
  },
  deleteSale(id) {
    return request(`/sales/${id}/`, { method: "DELETE" });
  },
  updateSaleStatus(id, status) {
    return request(`/sales/${id}/`, {
      method: "PATCH",
      body: { status },
    });
  },
  getQuotations() {
    return request("/quotations/");
  },
  createQuotation(payload) {
    return request("/quotations/", { method: "POST", body: payload });
  },
  updateQuotation(id, payload) {
    return request(`/quotations/${id}/`, { method: "PATCH", body: payload });
  },
  deleteQuotation(id) {
    return request(`/quotations/${id}/`, { method: "DELETE" });
  },
  askChat(question) {
    return request("/chat/", { method: "POST", body: { question } });
  },
};
