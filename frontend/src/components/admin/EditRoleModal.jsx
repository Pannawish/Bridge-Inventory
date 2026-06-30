import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

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

// Role editor popup, stacked above ManageRolesModal. Holds its own permission
// draft seeded once from the role, committing only on Save — this is the ONLY
// place a role's permissions can be changed.
function EditRoleModal({ role, permissionOptions = [], onSave, onClose }) {
  const { t } = useLanguage();
  const isEdit = Boolean(role);
  const [name, setName] = useState(role?.name || "");
  const [permissionIds, setPermissionIds] = useState(() => getRolePermissionIds(role));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  function togglePermission(permissionId) {
    setPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Parent performs the API call + reload and closes this modal on success.
      await onSave({ name: name.trim(), permission_ids: permissionIds }, role?.id || null);
    } catch (err) {
      setError(err.message || t("userAccess.errors.saveRoleFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop admin-modal-stack" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("userAccess.rolesEyebrow")}</p>
            <h3 id="role-modal-title">{isEdit ? role.name : t("userAccess.newRole")}</h3>
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
          <label>
            <span className="required-label">{t("userAccess.roleName")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
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
                        checked={permissionIds.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
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

          {error ? <div className="error-banner admin-inline-banner">{error}</div> : null}

          <div className="admin-form-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("userAccess.saveRole")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditRoleModal;
