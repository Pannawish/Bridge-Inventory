// Modal component for user access administration workflows.

import { useLanguage } from "../../i18n/LanguageContext";

function getRolePermissionIds(role) {
  return (role?.permissions || []).map((permission) => permission.id);
}

// Read-only list of roles. Creating a role or clicking one opens the separate
// EditRoleModal (stacked on top), so editing a role's permissions is never mixed
// into a user — the source of the earlier state-bleed confusion.
function ManageRolesModal({ roles = [], onNewRole, onEditRole, onClose }) {
  const { t } = useLanguage();

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roles-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("userAccess.rolesEyebrow")}</p>
            <h3 id="roles-modal-title">{t("userAccess.rolesTitle")}</h3>
          </div>
          <div className="transaction-detail-actions">
            <button
              type="button"
              className="primary-button table-action-button"
              onClick={onNewRole}
            >
              {t("userAccess.newRole")}
            </button>
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <p className="admin-fieldset-heading">
          <span>{t("userAccess.rolesModalHint")}</span>
        </p>

        <div className="admin-role-list admin-role-list-modal">
          {roles.length ? (
            roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className="admin-role-button"
                onClick={() => onEditRole(role)}
              >
                <strong>{role.name}</strong>
                <span>
                  {t("userAccess.permissionCount", { count: getRolePermissionIds(role).length })}
                </span>
              </button>
            ))
          ) : (
            <p className="empty-copy">{t("userAccess.noRolesYet")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageRolesModal;
