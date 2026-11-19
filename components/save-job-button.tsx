"use client";
import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
const KEY = "werk-saved-jobs";
export function useSavedJobs() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { setSaved([]); } }, []);
  function toggle(id: string) { setSaved(current => { const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]; localStorage.setItem(KEY, JSON.stringify(next)); return next; }); }
  return { saved, toggle };
}
export function SaveJobButton({ id }: { id: string }) {
  const { saved, toggle } = useSavedJobs(); const active = saved.includes(id);
  return <button className={`save-button ${active ? "is-saved" : ""}`} aria-label={active ? "Remove saved job" : "Save job"} aria-pressed={active} onClick={() => toggle(id)}><Bookmark size={17} fill={active ? "currentColor" : "none"}/></button>;
}
