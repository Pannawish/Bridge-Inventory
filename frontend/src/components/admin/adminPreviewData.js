// Utility module for user access administration: admin preview data.

export const previewPermissionOptions = [
  "user",
  "group",
  "activitylog",
  "product",
  "category",
  "supplier",
  "customer",
  "purchase",
  "sale",
  "quotation",
  "billingnote",
  "paymentbatch",
  "creditnote",
].flatMap((moduleKey, moduleIndex) =>
  ["view", "add", "change", "delete"].map((action, actionIndex) => ({
    id: moduleIndex * 10 + actionIndex + 1,
    codename: `${action}_${moduleKey}`,
    name: `Can ${action} ${moduleKey}`,
    app_label: moduleKey === "user" || moduleKey === "group" ? "auth" : "inventory",
    model: moduleKey,
    action,
    module_key: moduleKey,
  }))
);

function pickPermissions(moduleRules) {
  return previewPermissionOptions.filter((permission) => {
    const allowedActions = moduleRules[permission.module_key];
    return allowedActions === "all" || allowedActions?.includes(permission.action);
  });
}

export const previewRoles = [
  {
    id: 1,
    name: "Admin",
    permissions: previewPermissionOptions,
  },
  {
    id: 2,
    name: "Manager",
    permissions: pickPermissions({
      product: "all",
      category: "all",
      supplier: "all",
      customer: "all",
      purchase: "all",
      sale: "all",
      quotation: "all",
      billingnote: "all",
      paymentbatch: "all",
      creditnote: "all",
    }),
  },
  {
    id: 3,
    name: "Sales",
    permissions: pickPermissions({
      customer: ["view", "add", "change"],
      product: ["view"],
      sale: ["view", "add", "change"],
      quotation: ["view", "add", "change"],
      billingnote: ["view", "add", "change"],
      creditnote: ["view", "add", "change"],
    }),
  },
  {
    id: 4,
    name: "Purchasing",
    permissions: pickPermissions({
      supplier: ["view", "add", "change"],
      product: ["view", "add", "change"],
      purchase: ["view", "add", "change"],
      paymentbatch: ["view"],
      quotation: ["view"],
    }),
  },
  {
    id: 5,
    name: "Accounting",
    permissions: pickPermissions({
      customer: ["view"],
      supplier: ["view"],
      purchase: ["view"],
      sale: ["view"],
      billingnote: ["view", "add", "change"],
      paymentbatch: ["view", "add", "change"],
      creditnote: ["view", "add", "change"],
    }),
  },
  {
    id: 6,
    name: "Viewer",
    permissions: pickPermissions({
      product: ["view"],
      category: ["view"],
      supplier: ["view"],
      customer: ["view"],
      purchase: ["view"],
      sale: ["view"],
      quotation: ["view"],
      billingnote: ["view"],
      paymentbatch: ["view"],
      creditnote: ["view"],
    }),
  },
];

export const previewUsers = [
  {
    id: 1,
    username: "admin.preview",
    email: "admin@example.com",
    first_name: "System",
    last_name: "Admin",
    is_active: true,
    is_staff: true,
    is_superuser: true,
    roles: [previewRoles[0]],
    permissions: previewPermissionOptions.map((permission) => `${permission.app_label}.${permission.codename}`),
  },
  {
    id: 2,
    username: "sales.preview",
    email: "sales@example.com",
    first_name: "Sales",
    last_name: "User",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    roles: [previewRoles[2]],
    permissions: previewRoles[2].permissions.map((permission) => `${permission.app_label}.${permission.codename}`),
  },
  {
    id: 3,
    username: "accounting.preview",
    email: "accounting@example.com",
    first_name: "Accounting",
    last_name: "User",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    roles: [previewRoles[4]],
    permissions: previewRoles[4].permissions.map((permission) => `${permission.app_label}.${permission.codename}`),
  },
  {
    id: 4,
    username: "viewer.preview",
    email: "viewer@example.com",
    first_name: "Read",
    last_name: "Only",
    is_active: false,
    is_staff: false,
    is_superuser: false,
    roles: [previewRoles[5]],
    permissions: previewRoles[5].permissions.map((permission) => `${permission.app_label}.${permission.codename}`),
  },
];

export const previewActivityLogs = [
  {
    id: "activity-preview-1",
    user: previewUsers[0],
    actor_username: "admin.preview",
    action: "login",
    object_type: "auth.User",
    object_id: "1",
    object_repr: "admin.preview",
    summary: "admin.preview signed in.",
    changes: {},
    ip_address: "127.0.0.1",
    user_agent: "Frontend preview",
    created_at: "2026-06-24T09:15:00+07:00",
  },
  {
    id: "activity-preview-2",
    user: previewUsers[0],
    actor_username: "admin.preview",
    action: "create",
    object_type: "auth.User",
    object_id: "2",
    object_repr: "sales.preview",
    summary: "Created user sales.preview.",
    changes: {
      username: { before: null, after: "sales.preview" },
      roles: { before: [], after: ["Sales"] },
      is_active: { before: null, after: true },
    },
    ip_address: "127.0.0.1",
    user_agent: "Frontend preview",
    created_at: "2026-06-24T09:25:00+07:00",
  },
  {
    id: "activity-preview-3",
    user: previewUsers[0],
    actor_username: "admin.preview",
    action: "update",
    object_type: "inventory.Product",
    object_id: "product-preview-1",
    object_repr: "USB-C Cable 2m",
    summary: "Updated product USB-C Cable 2m.",
    changes: {
      reorder_level: { before: 20, after: 35 },
      is_active: { before: true, after: true },
    },
    ip_address: "127.0.0.1",
    user_agent: "Frontend preview",
    created_at: "2026-06-24T10:05:00+07:00",
  },
  {
    id: "activity-preview-4",
    user: previewUsers[0],
    actor_username: "admin.preview",
    action: "delete",
    object_type: "auth.Group",
    object_id: "7",
    object_repr: "Temporary Role",
    summary: "Deleted role Temporary Role.",
    changes: {
      name: { before: "Temporary Role", after: null },
    },
    ip_address: "127.0.0.1",
    user_agent: "Frontend preview",
    created_at: "2026-06-24T10:45:00+07:00",
  },
];
