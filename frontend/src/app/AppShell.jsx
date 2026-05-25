import TabIcon from "../components/TabIcon";
import { tabs, tabGroups } from "./tabs";

function AppShell({
  activeTab,
  sidebarOpen,
  sidebarCollapsed,
  notice,
  error,
  loading,
  onToggleSidebarCollapsed,
  onCloseSidebar,
  onOpenSidebar,
  onSelectTab,
  onCloseNotice,
  t,
  children,
}) {
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const tabBadges = {};

  return (
    <div
      className={`app-shell${sidebarOpen ? " sidebar-open" : ""}${
        sidebarCollapsed ? " sidebar-collapsed" : ""
      }`}
    >
      <aside className={sidebarOpen ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-content">
          <div className="sidebar-top">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              aria-label={sidebarCollapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
              aria-expanded={!sidebarCollapsed}
              onClick={onToggleSidebarCollapsed}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1>{t("app.title")}</h1>
            <button
              type="button"
              className="sidebar-close-button"
              aria-label={t("sidebar.closeMenu")}
              onClick={onCloseSidebar}
            >
              X
            </button>
          </div>

          <nav className="sidebar-nav">
            {tabGroups.map((group) => {
              const groupTabs = tabs.filter((tab) => tab.group === group.id);
              if (!groupTabs.length) {
                return null;
              }

              return (
                <div className="sidebar-nav-group" key={group.id}>
                  <p className="sidebar-nav-group-label">{t(group.labelKey)}</p>
                  {groupTabs.map((tab) => {
                    const badgeCount = tabBadges[tab.id] || 0;
                    const tabLabel = t(`tabs.${tab.id}`);

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={tabLabel}
                        className={
                          tab.id === activeTab
                            ? "sidebar-nav-button active"
                            : "sidebar-nav-button"
                        }
                        onClick={() => onSelectTab(tab.id)}
                      >
                        <span className="sidebar-nav-icon">
                          <TabIcon tabId={tab.id} />
                        </span>
                        <span className="sidebar-nav-text">{tabLabel}</span>
                        {badgeCount > 0 ? (
                          <span
                            className="sidebar-nav-badge"
                            aria-label={`${badgeCount} pending`}
                          >
                            {badgeCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              title={t("sidebar.settings")}
              className={
                activeTab === "settings"
                  ? "sidebar-nav-button active"
                  : "sidebar-nav-button"
              }
              onClick={() => onSelectTab("settings")}
            >
              <span className="sidebar-nav-icon">
                <TabIcon tabId="settings" />
              </span>
              <span className="sidebar-nav-text">{t("sidebar.settings")}</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <div className="sidebar-backdrop" role="presentation" onClick={onCloseSidebar} />
      ) : null}

      <main className="main-panel">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={t("sidebar.openMenu")}
            onClick={onOpenSidebar}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-topbar-title">
            <span className="mobile-topbar-eyebrow">{t("app.title")}</span>
            <strong>
              {activeTab === "settings" ? t("settings.title") : t(`tabs.${activeTabMeta.id}`)}
            </strong>
          </div>
        </header>

        {notice ? (
          <div className="notice-banner">
            <span>{notice}</span>
            <button
              className="banner-close-button"
              type="button"
              aria-label={t("common.close")}
              onClick={onCloseNotice}
            >
              X
            </button>
          </div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <section className="section-card loading-card">
            <p>{t("app.loadingInventoryData")}</p>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default AppShell;
