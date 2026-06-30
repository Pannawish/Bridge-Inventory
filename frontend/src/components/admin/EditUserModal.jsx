import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

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

function getUserRoleIds(user) {
  return (user?.roles || []).map((role) => role.id);
}

// Self-contained user editor popup. Its draft lives entirely in local state
// seeded ONCE from the clicked user, so switching users never bleeds one user's
// edits into another and nothing is saved until the single Save button is hit.
function EditUserModal({ user, roles = [], canEditSuperuser = false, onSave, onClose }) {
  const { t } = useLanguage();
  const isEdit = Boolean(user);
  const [form, setForm] = useState(() =>
    user
      ? { ...BLANK_USER_FORM, ...user, password: "", role_ids: getUserRoleIds(user) }
      : { ...BLANK_USER_FORM }
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(roleId) {
    setForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      is_active: form.is_active,
      is_staff: form.is_staff,
      role_ids: form.role_ids,
    };
    if (canEditSuperuser) {
      payload.is_superuser = form.is_superuser;
    }
    if (form.password) {
      payload.password = form.password;
    }

    try {
      // Parent performs the API call + reload and closes this modal on success.
      await onSave(payload, user?.id || null);
    } catch (err) {
      setError(err.message || t("userAccess.errors.saveUserFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("userAccess.editUserEyebrow")}</p>
            <h3 id="user-modal-title">{isEdit ? user.username : t("userAccess.newUserTitle")}</h3>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span className="required-label">{t("login.username")}</span>
              <input
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("userAccess.email")}</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </label>
            <label>
              <span>{t("userAccess.firstName")}</span>
              <input
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
              />
            </label>
            <label>
              <span>{t("userAccess.lastName")}</span>
              <input
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
              />
            </label>
            <label className="full-width">
              <span className={!isEdit ? "required-label" : ""}>
                {isEdit ? t("userAccess.newPassword") : t("login.password")}
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                required={!isEdit}
                placeholder={isEdit ? t("userAccess.passwordPlaceholder") : ""}
              />
            </label>
          </div>

          <div className="admin-toggle-grid">
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => update("is_active", event.target.checked)}
              />
              <span>{t("userAccess.activeAccount")}</span>
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={form.is_staff}
                onChange={(event) => update("is_staff", event.target.checked)}
              />
              <span>{t("userAccess.staffAccess")}</span>
            </label>
            {canEditSuperuser ? (
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_superuser}
                  onChange={(event) => update("is_superuser", event.target.checked)}
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
              {roles.length ? (
                roles.map((role) => (
                  <label className="admin-checkbox" key={role.id}>
                    <input
                      type="checkbox"
                      checked={form.role_ids.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))
              ) : (
                <span className="admin-muted-line">{t("userAccess.noRolesYet")}</span>
              )}
            </div>
          </div>

          {error ? <div className="error-banner admin-inline-banner">{error}</div> : null}

          <div className="admin-form-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserModal;
