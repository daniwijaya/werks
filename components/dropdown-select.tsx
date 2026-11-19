"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Option = { label: string; value: string };
export function DropdownSelect({ name, label, value = "", options, compact = false, searchable = false }: { name: string; label: string; value?: string; options: Option[]; compact?: boolean; searchable?: boolean }) {
  const root = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState(value);
  const [query, setQuery] = useState("");
  const selectedLabel = options.find(option => option.value === selected)?.label ?? options[0]?.label ?? label;
  const visibleOptions = options.filter(option => option.label.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id")));

  useEffect(() => {
    setSelected(value);
    setQuery("");
    if (root.current) root.current.open = false;
  }, [value]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details ref={root} className={`dropdown-select ${compact ? "dropdown-compact" : ""}`}>
    <summary aria-label={`${label}: ${selectedLabel}`}>
      <span className="dropdown-label">{selectedLabel}</span><ChevronDown className="dropdown-chevron" size={15}/>
    </summary>
    <div className={`dropdown-menu ${searchable ? "dropdown-menu-searchable" : ""}`} role="menu" aria-label={label}>
      {searchable && <label className="dropdown-search"><Search size={15}/><input type="search" role="searchbox" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}...`} value={query} onChange={event => setQuery(event.target.value)} onClick={event => event.stopPropagation()}/></label>}
      {visibleOptions.length ? visibleOptions.map(option => <button key={option.value || "all"} type="button" role="menuitemradio" aria-checked={selected === option.value} className="dropdown-option" onClick={() => { setSelected(option.value); setQuery(""); if (root.current) root.current.open = false; }}>
        <span>{option.label}</span>{selected === option.value && <Check size={15}/>}
      </button>) : <p className="dropdown-no-results">No matching locations</p>}
    </div>
    <input type="hidden" name={name} value={selected}/>
  </details>;
}
