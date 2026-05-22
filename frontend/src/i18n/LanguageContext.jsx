import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SUPPORTED_LANGUAGES, translations } from "./translations";

const STORAGE_KEY = "language";
const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext(null);

function resolveKey(dictionary, key) {
  return key.split(".").reduce(
    (value, part) => (value && value[part] !== undefined ? value[part] : undefined),
    dictionary
  );
}

function interpolate(template, params) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined && params[name] !== null ? `${params[name]}` : match
  );
}

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch {
    // ignore storage access failures
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore storage access failures
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo(() => {
    const setLanguage = (next) => {
      if (SUPPORTED_LANGUAGES.includes(next)) {
        setLanguageState(next);
      }
    };

    const t = (key, params) => {
      const active = translations[language] || translations[DEFAULT_LANGUAGE];
      let result = resolveKey(active, key);
      if (result === undefined) {
        result = resolveKey(translations[DEFAULT_LANGUAGE], key);
      }
      if (result === undefined) {
        return key;
      }
      return typeof result === "string" ? interpolate(result, params) : result;
    };

    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
