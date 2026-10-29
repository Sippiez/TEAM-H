"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "cn";
import type { FormField } from "@/lib/types";

import { useI18n } from "./i18n";
import { textInput } from "./styles";

interface RouteProps {
  fields: FormField[];
  selectedId: string | null;
  visited: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
}

type FieldFilter = "all" | "required" | "explained";

const HORIZONTAL = "(max-width: 1080px)";
const KEYS = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"];

/** Fields drawn as stations on one line, grouped into contiguous section runs. */
export function Route({ fields, selectedId, visited, onSelect }: RouteProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FieldFilter>("all");
  const { t: tr } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const yahRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const lastSelected = useRef<string | null>(null);

  const runs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = fields.filter((f) => {
      if (filter === "required" && !f.required) return false;
      if (filter === "explained" && !visited.has(f.id)) return false;
      return !q || f.label.toLowerCase().includes(q) || f.section.toLowerCase().includes(q);
    });
    const out: { key: string; section: string; items: FormField[] }[] = [];
    for (const f of shown) {
      const last = out.at(-1);
      if (last && last.section === f.section) last.items.push(f);
      else out.push({ key: `${f.section}-${f.id}`, section: f.section, items: [f] });
    }
    return out;
  }, [fields, filter, query, visited]);

  const hasRequiredFields = fields.some((f) => f.required);

  const place = useCallback(
    (animate: boolean, scroll: boolean) => {
      const yah = yahRef.current;
      const track = trackRef.current;
      const nav = navRef.current;
      if (!yah || !track || !nav) return;
      const btn = selectedId
        ? track.querySelector<HTMLElement>(`[data-station="${CSS.escape(selectedId)}"]`)
        : null;
      const dot = btn?.querySelector<HTMLElement>(".pr-stn-dot");
      if (!btn || !dot) {
        yah.hidden = true;
        placed.current = false;
        return;
      }
      const d = dot.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      const x = d.left + d.width / 2 - t.left - 18;
      const y = d.top + d.height / 2 - t.top - 18;
      const anim = animate && placed.current;
      yah.classList.toggle("no-anim", !anim);
      yah.style.transform = `translate(${x}px, ${y}px)`;
      yah.hidden = false;
      placed.current = true;
      if (!anim) {
        void yah.offsetWidth;
        requestAnimationFrame(() => yah.classList.remove("no-anim"));
      }
      if (!scroll) return;
      const b = btn.getBoundingClientRect();
      const s = nav.getBoundingClientRect();
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (window.matchMedia(HORIZONTAL).matches) {
        if (b.left < s.left + 16 || b.right > s.right - 16) {
          nav.scrollBy({ left: b.left - s.left - (s.width - b.width) / 2, behavior });
        }
      } else if (b.top < s.top + 72 || b.bottom > s.bottom - 72) {
        nav.scrollBy({ top: b.top - s.top - (s.height - b.height) / 2, behavior });
      }
    },
    [selectedId],
  );

  useLayoutEffect(() => {
    const changed = lastSelected.current !== selectedId;
    lastSelected.current = selectedId;
    place(changed, changed);
  }, [selectedId, runs, place]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => place(false, false));
    ro.observe(track);
    return () => ro.disconnect();
  }, [place]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!KEYS.includes(e.key)) return;
    const btns = [...(trackRef.current?.querySelectorAll<HTMLButtonElement>(".pr-stn") ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const j =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? btns.length - 1
          : e.key === "ArrowDown" || e.key === "ArrowRight"
            ? Math.min(btns.length - 1, i + 1)
            : Math.max(0, i - 1);
    btns[j]?.focus();
  };

  return (
    <nav
      ref={navRef}
      aria-labelledby="route-title"
      className="relative overflow-x-auto overflow-y-hidden border-b border-rule bg-desk pt-3.5 pb-2.5 desk:overflow-auto desk:border-r desk:border-b-0 desk:pt-5 desk:pr-3.5 desk:pb-24 desk:pl-2.5"
    >
      <div className="sticky left-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pb-2 desk:static desk:flex-col desk:gap-0.5 desk:pr-1.5 desk:pb-3 desk:pl-3.5">
        <h2 id="route-title" className="text-[17px]">
          {tr.fieldsTitle}
        </h2>
        <p className="text-[15px] text-ink-2 tabular-nums" aria-live="polite">
          {tr.viewed(visited.size, fields.length)}
        </p>
        <div role="group" aria-label={tr.fieldFilters} className="flex w-full flex-wrap gap-1.5 pt-1">
          {(
            [
              ["all", tr.allFields],
              ...(hasRequiredFields ? [["required", tr.requiredFields] as const] : []),
              ["explained", tr.explainedFields],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-9 cursor-pointer rounded-full border px-3 text-[14px] font-semibold",
                filter === value
                  ? "border-ink bg-highlighter text-ink"
                  : "border-quiet-stroke bg-paper text-ink-2 hover:border-ink hover:bg-hover-wash",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {fields.length > 12 && (
          <div className="w-full pt-2 max-desk:max-w-[min(360px,calc(100vw-32px))]">
            <label htmlFor="route-find" className="mb-1 block text-[15px] font-bold">
              {tr.findField}
            </label>
            <input
              id="route-find"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              className={cn(textInput, "min-h-11 text-[15.5px]")}
            />
          </div>
        )}
      </div>
      <div ref={trackRef} className="pr-track relative">
        {runs.length === 0 ? (
          <p className="px-4 py-3 text-[15.5px] text-ink-2 desk:pl-3.5">{tr.noFieldMatch}</p>
        ) : (
          <div className="pr-track-inner" onKeyDown={onKeyDown}>
            {runs.map((run) => (
              <div key={run.key} className="pr-sec">
                <div className="pr-sec-head">{run.section}</div>
                <ol>
                  {run.items.map((f, i) => {
                    const seen = visited.has(f.id);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          data-station={f.id}
                          aria-current={f.id === selectedId ? "step" : undefined}
                          onClick={() => onSelect(f.id)}
                          className={cn(
                            "pr-stn",
                            i === 0 && "is-first",
                            i === run.items.length - 1 && "is-last",
                            seen && "is-visited",
                          )}
                        >
                          <span className="pr-stn-dot" aria-hidden="true" />
                          <span className="pr-stn-yah">{tr.youAreHere}</span>
                          <span className="pr-stn-label">{f.label}</span>
                          {f.required && (
                            <span className="mt-1 inline-flex rounded-sm border border-ink px-1.5 py-0.5 text-[12px] font-bold leading-tight">
                              {tr.required}
                            </span>
                          )}
                          <span className="pr-stn-meta">
                            {tr.page(f.page)}
                            {seen && <span className="sr-only">{tr.viewedSr}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
        <span ref={yahRef} className="pr-yah no-anim" aria-hidden="true" hidden />
      </div>
    </nav>
  );
}
