const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "");

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

let isRefreshing = false;

async function request(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("Backend API is not configured for this deployment.");
  }

  const { params, ...requestOptions } = options;
  const queryString = buildQueryString(params);
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;
  
  const accessToken =
    localStorage.getItem("inventory_access_token") ||
    sessionStorage.getItem("inventory_access_token");

  const config = {
    method: "GET",
    ...requestOptions,
    headers: {
      ...(requestOptions.headers || {}),
    },
  };

  if (accessToken) {
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (config.body && !(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshToken =
      localStorage.getItem("inventory_refresh_token") ||
      sessionStorage.getItem("inventory_refresh_token");

    if (refreshToken && !isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newAccessToken = refreshData.access;

          localStorage.setItem("inventory_access_token", newAccessToken);
          sessionStorage.setItem("inventory_access_token", newAccessToken);

          config.headers["Authorization"] = `Bearer ${newAccessToken}`;
          const retryResponse = await fetch(url, config);
          const retryData = await retryResponse.json().catch(() => ({}));

          isRefreshing = false;
          if (!retryResponse.ok) {
            throw new Error(retryData.error || retryData.detail || "Request failed after refresh.");
          }
          return retryData;
        } else {
          isRefreshing = false;
          window.dispatchEvent(new Event("auth-expired"));
        }
      } catch (err) {
        isRefreshing = false;
        window.dispatchEvent(new Event("auth-expired"));
      }
    } else {
      window.dispatchEvent(new Event("auth-expired"));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || "Request failed.");
  }

  return data;
}

export const api = {
  getDashboard(params) {
    return request("/dashboard/", { params });
  },
  getDashboardSegment(params) {
    return request("/dashboard/segment/", { params });
  },
  getProductLookups(params) {
    return request("/lookups/products/", { params });
  },
  getProductHistory(productId) {
    return request(`/products/${productId}/history/`);
  },
  getProductStockLayers(productId, params) {
    return request(`/products/${productId}/stock-layers/`, { params });
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
  getEligibleCreditNoteSales(params) {
    return request("/eligibility/credit-note-sales/", { params });
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
  getProduct(id) {
    return request(`/products/${id}/`);
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
  getPurchase(id) {
    return request(`/purchases/${id}/`);
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
  getSale(id) {
    return request(`/sales/${id}/`);
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
  getQuotation(id) {
    return request(`/quotations/${id}/`);
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
  getBillingNote(id) {
    return request(`/billing-notes/${id}/`);
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
  getPaymentBatch(id) {
    return request(`/payment-batches/${id}/`);
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
  getCreditNotes(params) {
    return request("/credit-notes/", { params });
  },
  getCreditNote(id) {
    return request(`/credit-notes/${id}/`);
  },
  createCreditNote(payload) {
    return request("/credit-notes/", { method: "POST", body: payload });
  },
  updateCreditNote(id, payload) {
    return request(`/credit-notes/${id}/`, { method: "PATCH", body: payload });
  },
  deleteCreditNote(id) {
    return request(`/credit-notes/${id}/`, { method: "DELETE" });
  },
  askChat(question) {
    return request("/chat/", { method: "POST", body: { question } });
  },
  generateAiReport(payload) {
    return request("/ai-reports/", { method: "POST", body: payload });
  },
  getAdminUsers(params) {
    return request("/admin/users/", { params });
  },
  createAdminUser(payload) {
    return request("/admin/users/", { method: "POST", body: payload });
  },
  updateAdminUser(id, payload) {
    return request(`/admin/users/${id}/`, { method: "PATCH", body: payload });
  },
  deleteAdminUser(id) {
    return request(`/admin/users/${id}/`, { method: "DELETE" });
  },
  getAdminRoles(params) {
    return request("/admin/roles/", { params });
  },
  createAdminRole(payload) {
    return request("/admin/roles/", { method: "POST", body: payload });
  },
  updateAdminRole(id, payload) {
    return request(`/admin/roles/${id}/`, { method: "PATCH", body: payload });
  },
  deleteAdminRole(id) {
    return request(`/admin/roles/${id}/`, { method: "DELETE" });
  },
  getPermissionOptions() {
    return request("/admin/roles/permission-options/");
  },
  getActivityLogs(params) {
    return request("/activity-logs/", { params });
  },
  login(username, password) {
    return request("/auth/login/", { method: "POST", body: { username, password } });
  },
  refreshToken(refresh) {
    return request("/auth/refresh/", { method: "POST", body: { refresh } });
  },
  getMe() {
    return request("/auth/me/");
  },
};
