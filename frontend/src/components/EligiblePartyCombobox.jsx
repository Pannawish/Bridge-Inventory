import { useEffect, useMemo, useRef, useState } from "react";

function normalizeSearch(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

export default function EligiblePartyCombobox({
  id,
  label,
  value,
  options,
  placeholder,
  emptyMessage,
  onChange,
}) {
  const [query, setQuery] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const externalValueRef = useRef(value || "");
  const selectedValueRef = useRef(value || "");

  selectedValueRef.current = value || "";

  useEffect(() => {
    const normalizedValue = value || "";
    if (normalizedValue !== externalValueRef.current) {
      externalValueRef.current = normalizedValue;
      setQuery(normalizedValue);
    }
  }, [value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      normalizeSearch(option).includes(normalizedQuery)
    );
  }, [options, query]);

  function notifyChange(nextValue) {
    externalValueRef.current = nextValue;
    if (nextValue !== selectedValueRef.current) {
      onChange(nextValue);
    }
  }

  function handleInputChange(event) {
    const nextQuery = event.target.value;
    const exactMatch = options.find(
      (option) => normalizeSearch(option) === normalizeSearch(nextQuery)
    );

    setQuery(nextQuery);
    setIsOpen(true);
    notifyChange(exactMatch || "");
  }

  function handleSelect(nextValue) {
    setQuery(nextValue);
    setIsOpen(false);
    notifyChange(nextValue);
  }

  function handleBlur() {
    window.setTimeout(() => {
      setIsOpen(false);
      setQuery(selectedValueRef.current || "");
    }, 120);
  }

  const listId = `${id}-listbox`;

  return (
    <label className="supplier-combobox-field">
      <span className="required-label">{label}</span>
      <div className="supplier-combobox">
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          required
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
        />

        {isOpen ? (
          <div className="supplier-combobox-menu" id={listId} role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={
                    option === value
                      ? "supplier-combobox-option active"
                      : "supplier-combobox-option"
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="supplier-combobox-empty">{emptyMessage}</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
