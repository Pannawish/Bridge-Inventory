# Bridge Inventory — Authentication, Access Control, and Activity Log

This document describes the current login flow, permission model, admin user-management APIs, and activity logging implemented in Bridge Inventory.

## 1. Overview

Bridge Inventory uses Django authentication, Django groups and permissions, Django REST Framework, and Simple JWT.

Key design points:

- There is no self-registration flow.
- Accounts are created by administrators.
- JWT access and refresh tokens are used for frontend API access.
- Guest mode still exists for local development and review.
- Detailed backend permission enforcement is enabled only when `INVENTORY_REQUIRE_AUTH=True`.
- Activity logging records logins and create/update/delete operations.

## 2. Authentication Model

The system uses:

- Django `User` for account identity, password hashing, `is_staff`, and `is_superuser`
- Django `Group` for role-style access management
- Django `Permission` for endpoint authorization
- DRF `JWTAuthentication` for Bearer-token API access
- Simple JWT for token issue and refresh

When `INVENTORY_REQUIRE_AUTH=False`:

- API endpoints keep the project’s development-friendly behavior
- guest mode remains usable
- detailed Django model-permission checks are not enforced

When `INVENTORY_REQUIRE_AUTH=True`:

- login is required for API use
- model viewsets enforce Django `view` / `add` / `change` / `delete` permissions
- admin user-management and activity-log APIs require authenticated admin access

## 3. Backend Configuration

Main backend settings live in [backend/config/settings.py](../../backend/config/settings.py).

Relevant configuration:

- `rest_framework_simplejwt` is installed
- DRF default authentication is `rest_framework_simplejwt.authentication.JWTAuthentication`
- access token lifetime is 30 minutes
- refresh token lifetime is 7 days
- default permission mode switches on `INVENTORY_REQUIRE_AUTH`

The project also adds a custom permission layer in:

- [backend/inventory/permissions.py](../../backend/inventory/permissions.py)
- [backend/inventory/access_control.py](../../backend/inventory/access_control.py)

`InventoryModelPermissions` extends Django model permissions so REST operations map to:

- `GET` -> `view_*`
- `POST` -> `add_*`
- `PATCH` / `PUT` -> `change_*`
- `DELETE` -> `delete_*`

## 4. Authentication Endpoints

Defined in [backend/config/urls.py](../../backend/config/urls.py) and [backend/inventory/auth_views.py](../../backend/inventory/auth_views.py):

- `POST /api/auth/login/`
  - handled by `InventoryTokenObtainPairView`
  - validates username and password
  - returns `access` and `refresh` tokens
  - writes an activity-log entry for successful sign-in

- `POST /api/auth/refresh/`
  - accepts a refresh token
  - returns a new access token

- `GET /api/auth/me/`
  - returns current-user profile data, groups, permissions, and admin capability flags

Current `/api/auth/me/` response shape includes fields like:

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "first_name": "System",
  "last_name": "Admin",
  "is_staff": true,
  "is_superuser": true,
  "groups": [
    { "id": 1, "name": "Admin" }
  ],
  "permissions": [
    "inventory.view_product",
    "inventory.change_product"
  ],
  "can_manage_users": true,
  "can_view_activity_log": true
}
```

## 5. Frontend Login Flow

Frontend auth state is handled in [frontend/src/auth/AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx).

It exposes:

- `user`
- `isGuest`
- `isAuthenticated`
- `loading`
- `login(username, password, rememberMe)`
- `logout()`
- `continueAsGuest()`

Request handling is centralized in [frontend/src/api.js](../../frontend/src/api.js).

Behavior:

1. Login posts credentials to `/api/auth/login/`
2. Any old access/refresh tokens are removed from both browser stores
3. Access and refresh tokens are stored in exactly one browser store based on the `Remember Me` choice
4. Frontend loads `/api/auth/me/`
5. API requests automatically send `Authorization: Bearer <access>`
6. On `401`, the frontend attempts one silent refresh through `/api/auth/refresh/`
7. If refresh fails, the frontend clears auth state and returns to the login page

Storage rules:

- `rememberMe=true` -> tokens stored in `localStorage`
- `rememberMe=false` -> tokens stored in `sessionStorage`
- guest mode flag stored in `sessionStorage` as `inventory_is_guest`

Important current behavior:

- `AuthContext.login()` clears `inventory_access_token` and `inventory_refresh_token` from both `localStorage` and `sessionStorage` before writing the new tokens. This prevents a stale token in the other store from shadowing the fresh login token.
- `api.js` reads `localStorage` before `sessionStorage`, so the single-store write on login is intentional.
- Request-time refresh writes the new access token back to the same store that holds the refresh token.
- A background refresh interval runs every 15 minutes while a user session is active.
- Logout, failed initialization, failed refresh, and the `auth-expired` browser event clear both token stores plus the guest flag.
- Request errors expose `error.status`, allowing callers to distinguish `401`/`403` authorization failures from service outages.

## 6. User Access and Roles

The project now includes app-level user administration, not just Django’s built-in `/admin/`.

Backend APIs:

- `GET/POST /api/admin/users/`
- `PATCH/DELETE /api/admin/users/<id>/`
- `GET/POST /api/admin/roles/`
- `PATCH/DELETE /api/admin/roles/<id>/`
- `GET /api/admin/roles/permission-options/`

Frontend pages:

- `Administration -> User Access`
- `Administration -> Activity Log`

Frontend files:

- [frontend/src/components/admin/UserAccessPage.jsx](../../frontend/src/components/admin/UserAccessPage.jsx)
- [frontend/src/components/admin/ActivityLogPage.jsx](../../frontend/src/components/admin/ActivityLogPage.jsx)
- [frontend/src/auth/permissions.js](../../frontend/src/auth/permissions.js)

Default role groups are created automatically if missing:

- `Admin`
- `Manager`
- `Sales`
- `Purchasing`
- `Accounting`
- `Viewer`

Important behavior:

- role membership is stored through Django `Group`
- role permissions are stored through Django `Permission`
- admins can customize role permissions from the app
- the helper only seeds missing default groups; it does not overwrite edited role permissions

## 7. Sidebar and UI Permission Behavior

Sidebar visibility is permission-aware.

Implemented in:

- [frontend/src/app/tabs.js](../../frontend/src/app/tabs.js)
- [frontend/src/app/AppShell.jsx](../../frontend/src/app/AppShell.jsx)
- [frontend/src/App.jsx](../../frontend/src/App.jsx)
- [frontend/src/auth/permissions.js](../../frontend/src/auth/permissions.js)

Behavior:

- admin-only tabs such as `User Access` and `Activity Log` are hidden unless the current user can access them
- if a user loses access to the currently active tab, the app falls back to `dashboard`
- frontend hiding is convenience only; backend permission enforcement remains authoritative when auth is required

## 8. Activity Logging

Activity logging is implemented in:

- [backend/inventory/models.py](../../backend/inventory/models.py)
- [backend/inventory/audit.py](../../backend/inventory/audit.py)
- [backend/inventory/views.py](../../backend/inventory/views.py)

Tracked actions:

- successful login
- create
- update
- delete

Tracked details include:

- user
- actor username snapshot
- action
- object type
- object id
- object display snapshot
- summary text
- field-level `before` / `after` changes
- IP address
- user agent
- created timestamp

The activity-log API is:

- `GET /api/activity-logs/`

It supports filtering by:

- `search`
- `action`
- `object_type`
- `user`
- `date_from`
- `date_to`

The logger intentionally skips sensitive fields such as password- or token-like fields.

## 9. Superuser and Admin Rules

Current behavior:

- a user cannot delete their own account through the admin user API
- only a superuser can change another user’s `is_superuser` flag
- staff or superusers can access user-management pages and APIs
- activity-log access is available to user-access admins and users with `inventory.view_activitylog`

## 10. Setup and Operations

### Apply database changes

```bash
backend/.venv/bin/python backend/manage.py migrate
```

This is required for the `ActivityLog` table.

### Create an initial admin account

```bash
backend/.venv/bin/python backend/manage.py createsuperuser
```

### Enforce login and permissions

Set in `backend/.env`:

```env
INVENTORY_REQUIRE_AUTH=True
```

Restart Django after changing it.

## 11. Verification

Fast checks used for the current auth/access/activity implementation:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory.tests.ActivityLogApiTests inventory.tests.UserAccessAdminApiTests inventory.tests.InventoryPermissionEnforcementTests inventory.tests.LookupEligibilityTests.test_product_delete_without_transaction_history_succeeds inventory.tests.SeedOperationalDataCommandTests.test_seeded_operational_data_matches_current_workflows
```

Frontend verification:

```bash
cd frontend
npm run build
npm audit --audit-level=moderate
```

## 12. Current Limitations

- Detailed model-permission enforcement applies to DRF model viewsets. Custom function-based endpoints such as dashboard, lookup, eligibility, chat, and AI-report endpoints are still controlled mainly by authentication, not by fine-grained module permissions.
- Guest mode is still intentionally present for development when `INVENTORY_REQUIRE_AUTH=False`.
