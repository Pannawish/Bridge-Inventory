import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { previewPermissionOptions, previewRoles, previewUsers } from "./adminPreviewData";

const ACTION_ORDER = ["view", "add", "change", "delete"];
const MODULE_ORDER = [
  "user",
  "group",
  "activitylog",
  "product",
  "category",
  "supplier",
  "customer",
  "productsupplier",
  "purchase",
  "sale",
  "quotation",
  "billingnote",
  "paymentbatch",
  "creditnote",
];

const BLANK_USER_FORM = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  is_active: true,
  is_staff: false,
  is_superuser: false,
  role_ids: [],
};

const BLANK_ROLE_FORM = {
  name: "",
  permission_ids: [],
};

function normalizeListResponse(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function getUserRoleIds(user) {
  return (user?.roles || []).map((role) => role.id);
}

function getRolePermissionIds(role) {
  return (role?.permissions || []).map((permission) => permission.id);
}

function getLabel(t, baseKey, value) {
  const key = `${baseKey}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function sortPermissionGroups(groups) {
  return Object.entries(groups).sort(([left], [right]) => {
    const leftIndex = MODULE_ORDER.indexOf(left);
    const rightIndex = MODULE_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

function UserAccessPage({ previewMode = false }) {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [userForm, setUserForm] = useState(BLANK_USER_FORM);
  const [roleForm, setRoleForm] = useState(BLANK_ROLE_FORM);
  const [userSearch, setUserSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedUser = users.find((item) => item.id === selectedUserId) || null;
  const selectedRole = roles.find((item) => item.id === selectedRoleId) || null;
  const canEditSuperuser = Boolean(currentUser?.is_superuser);

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    if (!search) {
      return users;
    }
    return users.filter((item) =>
      [item.username, item.email, item.first_name, item.last_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [userSearch, users]);

  const permissionGroups = useMemo(() => {
    return permissionOptions.reduce((groups, permission) => {
      const moduleKey = permission.module_key || permission.model || "other";
      const action = permission.action || permission.codename?.split("_", 1)[0] || "";
      if (!groups[moduleKey]) {
        groups[moduleKey] = {};
      }
      groups[moduleKey][action] = permission;
      return groups;
    }, {});
  }, [permissionOptions]);

  async function loadAdminData() {
    if (previewMode) {
      const nextUsers = previewUsers;
      const nextRoles = previewRoles;
      setUsers(nextUsers);
      setRoles(nextRoles);
      setPermissionOptions(previewPermissionOptions);
      if (!selectedUserId && nextUsers.length) {
        const firstUser = nextUsers[0];
        setSelectedUserId(firstUser.id);
        setUserForm({
          ...BLANK_USER_FORM,
          ...firstUser,
          password: "",
          role_ids: getUserRoleIds(firstUser),
        });
      }
      if (!selectedRoleId && nextRoles.length) {
        const firstRole = nextRoles[0];
        setSelectedRoleId(firstRole.id);
        setRoleForm({
          name: firstRole.name,
          permission_ids: getRolePermissionIds(firstRole),
        });
      }
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [usersData, rolesData, permissionsData] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminRoles(),
        api.getPermissionOptions(),
      ]);
      const nextUsers = normalizeListResponse(usersData);
      const nextRoles = normalizeListResponse(rolesData);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setPermissionOptions(normalizeListResponse(permissionsData));

      if (!selectedUserId && nextUsers.length) {
        const firstUser = nextUsers[0];
        setSelectedUserId(firstUser.id);
        setUserForm({
          ...BLANK_USER_FORM,
          ...firstUser,
          password: "",
          role_ids: getUserRoleIds(firstUser),
        });
      }

      if (!selectedRoleId && nextRoles.length) {
        const firstRole = nextRoles[0];
        setSelectedRoleId(firstRole.id);
        setRoleForm({
          name: firstRole.name,
          permission_ids: getRolePermissionIds(firstRole),
        });
      }
    } catch (err) {
      setError(err.message || t("userAccess.errors.loadFailed"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showMessage(nextMessage) {
    setError("");
    setMessage(nextMessage);
  }

  function showError(nextError) {
    setMessage("");
    setError(nextError);
  }

  function startNewUser() {
    setSelectedUserId(null);
    setUserForm(BLANK_USER_FORM);
  }

  function editUser(nextUser) {
    setSelectedUserId(nextUser.id);
    setUserForm({
      ...BLANK_USER_FORM,
      ...nextUser,
      password: "",
      role_ids: getUserRoleIds(nextUser),
    });
  }

  function updateUserField(field, value) {
    setUserForm((form) => ({ ...form, [field]: value }));
  }

  function toggleUserRole(roleId) {
    setUserForm((form) => {
      const hasRole = form.role_ids.includes(roleId);
      return {
        ...form,
        role_ids: hasRole
          ? form.role_ids.filter((id) => id !== roleId)
          : [...form.role_ids, roleId],
      };
    });
  }

  async function saveUser(event) {
    event.preventDefault();
    if (previewMode) {
      showMessage(t("userAccess.previewReadOnly"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        username: userForm.username.trim(),
        email: userForm.email.trim(),
        first_name: userForm.first_name.trim(),
        last_name: userForm.last_name.trim(),
        is_active: userForm.is_active,
        is_staff: userForm.is_staff,
        role_ids: userForm.role_ids,
      };

      if (canEditSuperuser) {
        payload.is_superuser = userForm.is_superuser;
      }
      if (userForm.password) {
        payload.password = userForm.password;
      }

      const saved = selectedUser
        ? await api.updateAdminUser(selectedUser.id, payload)
        : await api.createAdminUser(payload);

      showMessage(selectedUser ? t("userAccess.userUpdated") : t("userAccess.userCreated"));
      await loadAdminData();
      editUser(saved);
    } catch (err) {
      showError(err.message || t("userAccess.errors.saveUserFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleUserActive(nextUser) {
    if (previewMode) {
      editUser(nextUser);
      showMessage(t("userAccess.previewReadOnly"));
      return;
    }
    setBusy(true);
    try {
      const saved = await api.updateAdminUser(nextUser.id, {
        is_active: !nextUser.is_active,
      });
      showMessage(saved.is_active ? t("userAccess.userActivated") : t("userAccess.userDeactivated"));
      await loadAdminData();
      editUser(saved);
    } catch (err) {
      showError(err.message || t("userAccess.errors.saveUserFailed"));
    } finally {
      setBusy(false);
    }
  }

  function startNewRole() {
    setSelectedRoleId(null);
    setRoleForm(BLANK_ROLE_FORM);
  }

  function editRole(nextRole) {
    setSelectedRoleId(nextRole.id);
    setRoleForm({
      name: nextRole.name,
      permission_ids: getRolePermissionIds(nextRole),
    });
  }

  function toggleRolePermission(permissionId) {
    setRoleForm((form) => {
      const hasPermission = form.permission_ids.includes(permissionId);
      return {
        ...form,
        permission_ids: hasPermission
          ? form.permission_ids.filter((id) => id !== permissionId)
          : [...form.permission_ids, permissionId],
      };
    });
  }

  async function saveRole(event) {
    event.preventDefault();
    if (previewMode) {
      showMessage(t("userAccess.previewReadOnly"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        permission_ids: roleForm.permission_ids,
      };
      const saved = selectedRole
        ? await api.updateAdminRole(selectedRole.id, payload)
        : await api.createAdminRole(payload);
      showMessage(selectedRole ? t("userAccess.roleUpdated") : t("userAccess.roleCreated"));
      await loadAdminData();
      editRole(saved);
    } catch (err) {
      showError(err.message || t("userAccess.errors.saveRoleFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-layout admin-page">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("userAccess.eyebrow")}</p>
            <h3>{t("userAccess.title")}</h3>
          </div>
          <div className="section-heading-actions">
            <button className="secondary-button" type="button" onClick={loadAdminData} disabled={busy}>
              {t("userAccess.refresh")}
            </button>
            <button className="primary-button" type="button" onClick={startNewUser}>
              {t("userAccess.newUser")}
            </button>
          </div>
        </div>

        {previewMode ? (
          <div className="admin-preview-banner">
            <strong>{t("userAccess.previewTitle")}</strong>
            <span>{t("userAccess.previewMessage")}</span>
          </div>
        ) : null}

        {message ? <div className="notice-banner admin-inline-banner">{message}</div> : null}
        {error ? <div className="error-banner admin-inline-banner">{error}</div> : null}

        <div className="admin-toolbar">
          <label className="admin-search-field">
            <span>{t("userAccess.searchUsers")}</span>
            <input
              type="search"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder={t("userAccess.searchUsersPlaceholder")}
            />
          </label>
        </div>

        <div className="transaction-table-window admin-table-window">
          <div className="table-scroll desktop-table">
            <table className="transaction-history-table admin-table">
              <thead>
                <tr>
                  <th className="table-index-cell">{t("userAccess.colIndex")}</th>
                  <th>{t("userAccess.colUser")}</th>
                  <th>{t("userAccess.colEmail")}</th>
                  <th>{t("userAccess.colRoles")}</th>
                  <th>{t("userAccess.colState")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item, index) => (
                  <tr
                    key={item.id}
                    className={
                      selectedUserId === item.id ? "partner-table-row active" : "partner-table-row"
                    }
                  >
                    <td className="table-index-cell">{index + 1}</td>
                    <td>
                      <strong>{item.username}</strong>
                      {item.is_staff ? <span className="admin-muted-line">{t("userAccess.staff")}</span> : null}
                    </td>
                    <td>{item.email || t("common.noData")}</td>
                    <td>
                      <div className="admin-pill-row">
                        {(item.roles || []).length
                          ? item.roles.map((role) => (
                              <span className="admin-pill" key={role.id}>
                                {role.name}
                              </span>
                            ))
                          : t("userAccess.noRoles")}
                      </div>
                    </td>
                    <td>
                      <span className={item.is_active ? "admin-state active" : "admin-state inactive"}>
                        {item.is_active ? t("userAccess.active") : t("userAccess.inactive")}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="table-action-button" type="button" onClick={() => editUser(item)}>
                          {t("common.edit")}
                        </button>
                        <button
                          className="secondary-button table-action-button"
                          type="button"
                          onClick={() => toggleUserActive(item)}
                          disabled={busy || item.id === currentUser?.id}
                        >
                          {item.is_active ? t("userAccess.deactivate") : t("userAccess.activate")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedUser ? t("userAccess.editUserEyebrow") : t("userAccess.newUserEyebrow")}</p>
            <h3>{selectedUser ? selectedUser.username : t("userAccess.newUserTitle")}</h3>
          </div>
        </div>

        <form className="admin-form" onSubmit={saveUser}>
          <div className="form-grid">
            <label>
              <span className="required-label">{t("login.username")}</span>
              <input
                value={userForm.username}
                onChange={(event) => updateUserField("username", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("userAccess.email")}</span>
              <input
                type="email"
                value={userForm.email}
                onChange={(event) => updateUserField("email", event.target.value)}
              />
            </label>
            <label>
              <span>{t("userAccess.firstName")}</span>
              <input
                value={userForm.first_name}
                onChange={(event) => updateUserField("first_name", event.target.value)}
              />
            </label>
            <label>
              <span>{t("userAccess.lastName")}</span>
              <input
                value={userForm.last_name}
                onChange={(event) => updateUserField("last_name", event.target.value)}
              />
            </label>
            <label className="full-width">
              <span className={!selectedUser ? "required-label" : ""}>
                {selectedUser ? t("userAccess.newPassword") : t("login.password")}
              </span>
              <input
                type="password"
                value={userForm.password}
                onChange={(event) => updateUserField("password", event.target.value)}
                required={!selectedUser}
                placeholder={selectedUser ? t("userAccess.passwordPlaceholder") : ""}
              />
            </label>
          </div>

          <div className="admin-toggle-grid">
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={userForm.is_active}
                onChange={(event) => updateUserField("is_active", event.target.checked)}
              />
              <span>{t("userAccess.activeAccount")}</span>
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={userForm.is_staff}
                onChange={(event) => updateUserField("is_staff", event.target.checked)}
              />
              <span>{t("userAccess.staffAccess")}</span>
            </label>
            {canEditSuperuser ? (
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={userForm.is_superuser}
                  onChange={(event) => updateUserField("is_superuser", event.target.checked)}
                />
                <span>{t("userAccess.superuserAccess")}</span>
              </label>
            ) : null}
          </div>

          <div className="admin-fieldset">
            <div className="admin-fieldset-heading">
              <strong>{t("userAccess.assignedRoles")}</strong>
              <span>{t("userAccess.assignedRolesHint")}</span>
            </div>
            <div className="admin-checkbox-grid">
              {roles.map((role) => (
                <label className="admin-checkbox" key={role.id}>
                  <input
                    type="checkbox"
                    checked={userForm.role_ids.includes(role.id)}
                    onChange={() => toggleUserRole(role.id)}
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="admin-form-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
            <button className="secondary-button" type="button" onClick={startNewUser}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("userAccess.rolesEyebrow")}</p>
            <h3>{t("userAccess.rolesTitle")}</h3>
          </div>
          <button className="secondary-button" type="button" onClick={startNewRole}>
            {t("userAccess.newRole")}
          </button>
        </div>

        <div className="admin-role-layout">
          <div className="admin-role-list">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={selectedRoleId === role.id ? "admin-role-button active" : "admin-role-button"}
                onClick={() => editRole(role)}
              >
                <strong>{role.name}</strong>
                <span>
                  {t("userAccess.permissionCount", {
                    count: getRolePermissionIds(role).length,
                  })}
                </span>
              </button>
            ))}
          </div>

          <form className="admin-form admin-role-form" onSubmit={saveRole}>
            <label>
              <span className="required-label">{t("userAccess.roleName")}</span>
              <input
                value={roleForm.name}
                onChange={(event) => setRoleForm((form) => ({ ...form, name: event.target.value }))}
                required
              />
            </label>

            <div className="admin-permission-table">
              <div className="admin-permission-header">
                <span>{t("userAccess.permissionModule")}</span>
                {ACTION_ORDER.map((action) => (
                  <span key={action}>{getLabel(t, "userAccess.permissionActions", action)}</span>
                ))}
              </div>
              {sortPermissionGroups(permissionGroups).map(([moduleKey, permissionsByAction]) => (
                <div className="admin-permission-row" key={moduleKey}>
                  <strong>{getLabel(t, "userAccess.permissionGroups", moduleKey)}</strong>
                  {ACTION_ORDER.map((action) => {
                    const permission = permissionsByAction[action];
                    return permission ? (
                      <label className="admin-permission-check" key={action}>
                        <input
                          type="checkbox"
                          checked={roleForm.permission_ids.includes(permission.id)}
                          onChange={() => toggleRolePermission(permission.id)}
                          aria-label={`${getLabel(t, "userAccess.permissionGroups", moduleKey)} ${getLabel(
                            t,
                            "userAccess.permissionActions",
                            action
                          )}`}
                        />
                      </label>
                    ) : (
                      <span className="admin-permission-empty" key={action}>
                        {t("userAccess.notAvailable")}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? t("common.saving") : t("userAccess.saveRole")}
              </button>
              <button className="secondary-button" type="button" onClick={startNewRole}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export default UserAccessPage;
