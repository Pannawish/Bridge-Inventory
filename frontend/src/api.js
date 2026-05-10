const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

function buildQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      const joinedValue = value
        .filter((item) => item !== undefined && item !== null && item !== "")
        .join(",");
      if (joinedValue) {
        query.set(key, joinedValue);
      }
      return;
    }

    query.set(key, value);
  });

  return query.toString();
}

async function request(path, options = {}) {
  const { params, ...requestOptions } = options;
  const queryString = buildQueryString(params);
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;
  const config = {
    method: "GET",
    ...requestOptions,
    headers: {
      ...(requestOptions.headers || {}),
    },
  };

  if (config.body && !(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
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
  getProductLookups(params) {
    return request("/lookups/products/", { params });
  },
  getSupplierLookups(params) {
    return request("/lookups/suppliers/", { params });
  },
  getCustomerLookups(params) {
    return request("/lookups/customers/", { params });
  },
  getEligibleBillingNoteSales(params) {
    return request("/eligibility/billing-note-sales/", { params });
  },
  getEligiblePaymentBatchPurchases(params) {
    return request("/eligibility/payment-batch-purchases/", { params });
  },
  getSuppliers(params) {
    return request("/suppliers/", { params });
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
  getCustomers(params) {
    return request("/customers/", { params });
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
  getCategories(params) {
    return request("/categories/", { params });
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
  getProducts(params) {
    return request("/products/", { params });
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
  getPurchases(params) {
    return request("/purchases/", { params });
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
  getSales(params) {
    return request("/sales/", { params });
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
  getQuotations(params) {
    return request("/quotations/", { params });
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
  getBillingNotes(params) {
    return request("/billing-notes/", { params });
  },
  createBillingNote(payload) {
    return request("/billing-notes/", { method: "POST", body: payload });
  },
  updateBillingNote(id, payload) {
    return request(`/billing-notes/${id}/`, { method: "PATCH", body: payload });
  },
  deleteBillingNote(id) {
    return request(`/billing-notes/${id}/`, { method: "DELETE" });
  },
  getPaymentBatches(params) {
    return request("/payment-batches/", { params });
  },
  createPaymentBatch(payload) {
    return request("/payment-batches/", { method: "POST", body: payload });
  },
  updatePaymentBatch(id, payload) {
    return request(`/payment-batches/${id}/`, { method: "PATCH", body: payload });
  },
  deletePaymentBatch(id) {
    return request(`/payment-batches/${id}/`, { method: "DELETE" });
  },
  askChat(question) {
    return request("/chat/", { method: "POST", body: { question } });
  },
};
