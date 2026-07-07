// Utility module for authentication and authorization: permissions.

export const TAB_PERMISSION_MAP = {
  dashboard: null,
  inventory: "inventory.view_product",
  chat: null,
  "ai-report": null,
  "purchase-history": "inventory.view_purchase",
  "payment-batches": "inventory.view_paymentbatch",
  quotations: "inventory.view_quotation",
  "sales-history": "inventory.view_sale",
  "billing-notes": "inventory.view_billingnote",
  "credit-notes": "inventory.view_creditnote",
  products: "inventory.view_product",
  categories: "inventory.view_category",
  suppliers: "inventory.view_supplier",
  customers: "inventory.view_customer",
  "user-access": "__manage_users__",
  "activity-log": "__view_activity_log__",
};

export function hasPermission(user, permission) {
  if (!permission) {
    return true;
  }
  if (!user) {
    return false;
  }
  if (user.is_superuser) {
    return true;
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : null;
  if (!permissions) {
    return true;
  }
  return permissions.includes(permission);
}

export function canManageUsers(user) {
  if (!user) {
    return false;
  }
  return Boolean(
    user.can_manage_users ||
      user.is_superuser ||
      user.is_staff ||
      hasPermission(user, "auth.view_user") ||
      hasPermission(user, "auth.change_user")
  );
}

export function canViewActivityLog(user) {
  if (!user) {
    return false;
  }
  return Boolean(
    user.can_view_activity_log ||
      canManageUsers(user) ||
      hasPermission(user, "inventory.view_activitylog")
  );
}

export function canAccessTab(tabId, user, isGuest = false, allowAdminPreview = false) {
  const permission = TAB_PERMISSION_MAP[tabId];
  if (permission === undefined) {
    return true;
  }
  if (permission === "__manage_users__") {
    if (allowAdminPreview && isGuest) {
      return true;
    }
    return canManageUsers(user);
  }
  if (permission === "__view_activity_log__") {
    if (allowAdminPreview && isGuest) {
      return true;
    }
    return canViewActivityLog(user);
  }
  if (isGuest) {
    return true;
  }
  return hasPermission(user, permission);
}

export function getVisibleTabs(tabs, user, isGuest = false, allowAdminPreview = false) {
  return tabs.filter((tab) => canAccessTab(tab.id, user, isGuest, allowAdminPreview));
}
