// Page component for user access administration workflows.

import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { previewPermissionOptions, previewRoles, previewUsers } from "./adminPreviewData";
import EditUserModal from "./EditUserModal";
import ManageRolesModal from "./ManageRolesModal";
import EditRoleModal from "./EditRoleModal";

function normalizeListResponse(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

// Admin "User Access" page. The page itself is a clean directory of users; all
// editing happens in popups (EditUserModal / ManageRolesModal → EditRoleModal),
// each holding its own draft and committing only on its single Save button. This
// replaced the older always-open inline forms, whose shared live state could
// bleed one record's edits into another.
function UserAccessPage({ previewMode = false }) {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Modal state. Each holds the record being edited; a null record = "create new".
  const [userModal, setUserModal] = useState(null); // { user: object|null } | null
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleModal, setRoleModal] = useState(null); // { role: object|null } | null

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
  }, [users, userSearch]);

  async function loadAdminData() {
    if (previewMode) {
      setUsers(previewUsers);
      setRoles(previewRoles);
      setPermissionOptions(previewPermissionOptions);
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
      setUsers(normalizeListResponse(usersData));
      setRoles(normalizeListResponse(rolesData));
      setPermissionOptions(normalizeListResponse(permissionsData));
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

  // Save handlers throw on failure so the calling modal can show the error inline
  // (e.g. a rejected weak password); on success they reload + close the modal.
  async function handleSaveUser(payload, id) {
    if (previewMode) {
      showMessage(t("userAccess.previewReadOnly"));
      setUserModal(null);
      return;
    }
    const saved = id
      ? await api.updateAdminUser(id, payload)
      : await api.createAdminUser(payload);
    showMessage(id ? t("userAccess.userUpdated") : t("userAccess.userCreated"));
    await loadAdminData();
    setUserModal(null);
    return saved;
  }

  async function handleToggleActive(targetUser) {
    if (previewMode) {
      showMessage(t("userAccess.previewReadOnly"));
      return;
    }
    setBusy(true);
    try {
      const saved = await api.updateAdminUser(targetUser.id, {
        is_active: !targetUser.is_active,
      });
      showMessage(saved.is_active ? t("userAccess.userActivated") : t("userAccess.userDeactivated"));
      await loadAdminData();
    } catch (err) {
      showError(err.message || t("userAccess.errors.saveUserFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRole(payload, id) {
    if (previewMode) {
      showMessage(t("userAccess.previewReadOnly"));
      setRoleModal(null);
      return;
    }
    const saved = id
      ? await api.updateAdminRole(id, payload)
      : await api.createAdminRole(payload);
    showMessage(id ? t("userAccess.roleUpdated") : t("userAccess.roleCreated"));
    await loadAdminData();
    setRoleModal(null);
    return saved;
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
            <button className="secondary-button" type="button" onClick={() => setRolesOpen(true)}>
              {t("userAccess.manageRoles")}
            </button>
            <button className="primary-button" type="button" onClick={() => setUserModal({ user: null })}>
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
                  <tr key={item.id} className="partner-table-row">
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
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => setUserModal({ user: item })}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          className="secondary-button table-action-button"
                          type="button"
                          onClick={() => handleToggleActive(item)}
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

      {userModal ? (
        <EditUserModal
          user={userModal.user}
          roles={roles}
          canEditSuperuser={canEditSuperuser}
          onSave={handleSaveUser}
          onClose={() => setUserModal(null)}
        />
      ) : null}

      {rolesOpen ? (
        <ManageRolesModal
          roles={roles}
          onNewRole={() => setRoleModal({ role: null })}
          onEditRole={(role) => setRoleModal({ role })}
          onClose={() => setRolesOpen(false)}
        />
      ) : null}

      {roleModal ? (
        <EditRoleModal
          role={roleModal.role}
          permissionOptions={permissionOptions}
          onSave={handleSaveRole}
          onClose={() => setRoleModal(null)}
        />
      ) : null}
    </div>
  );
}

export default UserAccessPage;
