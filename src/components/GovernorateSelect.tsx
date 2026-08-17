"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Accent-insensitive, so "beja" matches "Béja" and "gabes" matches "Gabès". */
function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Combobox for the delivery governorate. A native `<select>` hands its option list
 * to the OS, which paints it with the storefront's dark green — unreadable next to
 * the white checkout fields — so the list is rendered here and filtered as you type.
 */
export function GovernorateSelect({
  id,
  options,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const needle = fold(query);
    if (!needle) return [...options];
    return options.filter((option) => fold(option).includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Keep the highlighted row inside the scroll window while arrowing through.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = () => {
    setOpen(true);
    setActiveIndex(Math.max(0, matches.indexOf(value)));
  };

  const select = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        matches.length === 0 ? 0 : (current + step + matches.length) % matches.length
      );
      return;
    }

    // Enter only commits a highlighted row; when closed it submits the step.
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      select(matches[activeIndex]);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }

    if (event.key === "Tab" && open) {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        placeholder={value || "Governorate"}
        value={open ? query : value}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onMouseDown={() => {
          if (!open) openList();
        }}
        onKeyDown={handleKeyDown}
        className={`checkout-field checkout-field--menu ${
          invalid ? "checkout-field--invalid" : ""
        }`}
      />

      {open ? (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Governorate" className="checkout-menu">
          {matches.length === 0 ? (
            <li className="checkout-menu-empty">No governorate matches that.</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
                className="checkout-option"
              >
                <span>{option}</span>
                {option === value ? <span aria-hidden>✓</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
