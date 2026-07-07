// Page component for shared component workflows.

import { useLanguage } from "../i18n/LanguageContext";

const LANGUAGE_OPTIONS = [
  { value: "en", labelKey: "settings.language.english" },
  { value: "th", labelKey: "settings.language.thai" },
];

function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <section className="section-card settings-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h3>{t("settings.title")}</h3>
        </div>
      </div>

      <div className="settings-menu" aria-label={t("settings.menuLabel")}>
        <div className="settings-menu-item">
          <div className="settings-menu-text">
            <strong>{t("settings.language.title")}</strong>
            <span>{t("settings.language.description")}</span>
          </div>
          <div
            className="settings-language-toggle"
            role="radiogroup"
            aria-label={t("settings.language.title")}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={language === option.value}
                className={
                  language === option.value
                    ? "settings-language-option active"
                    : "settings-language-option"
                }
                onClick={() => setLanguage(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SettingsPage;
