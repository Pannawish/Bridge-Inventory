// React component for business partner: partner page shell.

import UniversalFilter from "../filters/UniversalFilter";
import { useLanguage } from "../../i18n/LanguageContext";

function PartnerPageShell({
  entityKey,
  allProfilesLabelKey,
  searchTerm,
  onSearchTermChange,
  isServerPaginated,
  filteredCount,
  totalCount,
  localCount,
  onResetFilters,
  activeChips,
  profileFilter,
  onProfileFilterChange,
  profileOptions,
  children,
}) {
  const { t } = useLanguage();

  // Single facet — the customer/supplier profile. (The old quick-filter pills
  // just duplicated this select, so they were dropped.)
  const filterFields = [
    {
      id: "profile",
      type: "select",
      section: "primary",
      label: t(`${entityKey}.profileFilter`),
      value: profileFilter,
      onChange: onProfileFilterChange,
      allValue: "all",
      allLabel: t(allProfilesLabelKey),
      options: profileOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    },
  ];

  return (
    <div className="stack-layout">
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t(`${entityKey}.searchPlaceholder`),
        }}
        meta={t(
          isServerPaginated ? `${entityKey}.pageCountServer` : `${entityKey}.pageCountLocal`,
          {
            count: filteredCount,
            total: isServerPaginated ? totalCount : localCount,
          }
        )}
        fields={filterFields}
        activeChips={activeChips}
        onReset={onResetFilters}
        labels={{
          more: t("filterControls.moreFilters"),
          reset: t("filterControls.resetFilter"),
          quick: t("filterControls.quickFilters"),
          clearAll: t("filterControls.clearAll"),
        }}
      />

      {children}
    </div>
  );
}

export default PartnerPageShell;
