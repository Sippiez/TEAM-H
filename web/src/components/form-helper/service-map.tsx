"use client";

import { useEffect, useRef, useState } from "react";

import { RESOURCES } from "@/lib/catalog/resources";
import { cn } from "cn";

import { useI18n } from "./i18n";

type Line = "P" | "B" | "T";
type At = "right" | "right-up" | "below" | "above" | "above-end";

const DASH: Record<Line, string | undefined> = { P: undefined, B: "10 7", T: "1 7" };

const STATIONS: { id: string; lines: Line[]; matches: (resourceId: string) => boolean }[] = [
  { id: "passports", lines: ["P"], matches: (r) => r.startsWith("passport") },
  { id: "sin", lines: ["P", "B"], matches: (r) => r === "sin" },
  { id: "ei", lines: ["B"], matches: (r) => r === "ei" || r.startsWith("ei-") },
  { id: "ccb", lines: ["B", "T"], matches: (r) => r === "ccb" },
  { id: "cpp", lines: ["B"], matches: (r) => r === "cpp" },
  { id: "oas", lines: ["B"], matches: (r) => r === "oas" },
  {
    id: "cra-sign-in",
    lines: ["T"],
    matches: (r) => r === "cra-sign-in" || r === "income-tax" || r === "cra-forms",
  },
];

interface Layout {
  w: number;
  h: number;
  pos: Record<string, [number, number, At]>;
  paths: Record<Line, [number, number][]>;
}

const LAYOUTS: Record<"wide" | "tall", Layout> = {
  wide: {
    w: 760,
    h: 400,
    pos: {
      passports: [90, 80, "right"],
      sin: [90, 230, "below"],
      ei: [290, 230, "below"],
      ccb: [470, 230, "above-end"],
      cpp: [570, 300, "below"],
      oas: [700, 300, "above"],
      "cra-sign-in": [680, 150, "above"],
    },
    paths: {
      P: [[90, 80], [90, 230]],
      B: [[90, 230], [470, 230], [540, 300], [700, 300]],
      T: [[470, 230], [550, 150], [680, 150]],
    },
  },
  tall: {
    w: 360,
    h: 620,
    pos: {
      passports: [36, 40, "right"],
      sin: [36, 140, "right"],
      ei: [36, 240, "right"],
      ccb: [36, 340, "right-up"],
      "cra-sign-in": [96, 430, "right"],
      cpp: [36, 510, "right"],
      oas: [36, 590, "right"],
    },
    paths: {
      P: [[36, 40], [36, 140]],
      B: [[36, 140], [36, 590]],
      T: [[36, 340], [96, 400], [96, 430]],
    },
  },
};

const resourceById = new Map(RESOURCES.map((r) => [r.id, r]));

/**
 * Transit-style map of common services. Lines are told apart by dash pattern, never hue.
 * `highlight` lists resource ids the navigator just suggested; matching stations are marked.
 */
export function ServiceMap({ highlight }: { highlight?: readonly string[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState<"wide" | "tall">("wide");
  const { t } = useI18n();

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setKey(entry.contentRect.width >= 600 ? "wide" : "tall"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = LAYOUTS[key];
  const active = highlight && highlight.length > 0 ? highlight : null;
  const matched = new Set(
    active ? STATIONS.filter((s) => active.some((id) => s.matches(id))).map((s) => s.id) : [],
  );
  const filtering = matched.size > 0;

  return (
    <section
      aria-labelledby="map-title"
      className={cn("pr-map flex flex-col gap-2.5 bg-paper px-4 py-4 shadow-card sm:px-6 sm:pt-[22px] sm:pb-[18px]", key === "tall" && "is-tall")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="map-title" className="text-[19px]">
          {t.mapTitle}
        </h2>
        <p className="text-[15.5px] text-ink-2">{t.mapHint}</p>
      </div>
      <div ref={stageRef} className="relative my-2 w-full" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
        <svg
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 size-full overflow-visible"
        >
          {(Object.keys(layout.paths) as Line[]).map((line) => (
            <polyline
              key={line}
              points={layout.paths[line].map((p) => p.join(",")).join(" ")}
              fill="none"
              className="stroke-ink"
              strokeWidth={3}
              strokeDasharray={DASH[line]}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <ul>
          {STATIONS.map((s) => {
            const r = resourceById.get(s.id);
            if (!r) return null;
            const [x, y, at] = layout.pos[s.id];
            const isMatch = matched.has(s.id);
            return (
              <li key={s.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "pr-map-link",
                    `at-${at}`,
                    s.lines.length > 1 && "is-x",
                    isMatch && "is-match",
                    filtering && !isMatch && "is-dim",
                  )}
                  style={{ left: `${(x / layout.w) * 100}%`, top: `${(y / layout.h) * 100}%` }}
                >
                  <span className="pr-map-dot" aria-hidden="true" />
                  <span className="pr-map-lab">
                    {t.stations[s.id]}
                    <span className="sr-only">
                      {isMatch ? t.suggested : ""}
                      {t.opensNewTab}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="flex flex-wrap gap-x-[22px] gap-y-2 border-t border-rule-2 pt-2.5 text-[15px] font-semibold text-ink-2">
        {(Object.keys(DASH) as Line[]).map((line) => (
          <li key={line} className="flex items-center gap-2">
            <svg width="34" height="8" viewBox="0 0 34 8" aria-hidden="true" focusable="false" className="flex-none">
              <line
                x1="3"
                y1="4"
                x2="31"
                y2="4"
                className="stroke-ink"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={DASH[line]}
              />
            </svg>
            {t.lines[line]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <i className="pr-interchange" aria-hidden="true" />
          {t.interchange}
        </li>
      </ul>
    </section>
  );
}
