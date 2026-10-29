"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "cn";
import type { PDFDocumentProxy, PDFPageProxy } from "@/lib/pdf/pdfjs";
import type { FormField } from "@/lib/types";

import { useI18n } from "./i18n";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  fields: FormField[];
  selectedId: string | null;
  visited: ReadonlySet<string>;
  showFields: boolean;
  /** Bump to scroll the selected field into view. */
  scrollKey: number;
  onSelect: (fieldId: string) => void;
}

export function PdfPage({
  doc,
  pageNumber,
  zoom,
  fields,
  selectedId,
  visited,
  showFields,
  scrollKey,
  onSelect,
}: PdfPageProps) {
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState<{ doc: PDFDocumentProxy; n: number; page: PDFPageProxy } | null>(
    null,
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (!cancelled) setLoaded({ doc, n: pageNumber, page });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  const page = loaded && loaded.doc === doc && loaded.n === pageNumber ? loaded.page : null;

  const viewport = useMemo(() => {
    if (!page || width <= 0) return null;
    const base = page.getViewport({ scale: 1 });
    return page.getViewport({ scale: Math.max(0.25, (width / base.width) * zoom) });
  }, [page, width, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!page || !viewport || !canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const task = page.render({
      canvas,
      viewport,
      transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
    });
    task.promise.catch(() => {
      /* cancelled by a newer render */
    });
    return () => task.cancel();
  }, [page, viewport]);

  const boxes = useMemo(() => {
    if (!viewport) return [];
    return fields.flatMap((field) =>
      field.rects.map((rect, i) => {
        const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
        const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
        return {
          key: `${field.id}-${i}`,
          field,
          index: i,
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        };
      }),
    );
  }, [fields, viewport]);

  useEffect(() => {
    if (!scrollKey || !selectedId || !viewport) return;
    const el = wrapperRef.current?.querySelector<HTMLElement>(`[data-field-id="${CSS.escape(selectedId)}"]`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center", inline: "nearest" });
    el?.classList.remove("is-arrived");
    if (!el || reduce) return;
    const timer = window.setTimeout(() => el.classList.add("is-arrived"), 300);
    return () => window.clearTimeout(timer);
    // Only an explicit request scrolls; re-renders for the same request must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, viewport]);

  return (
    <div ref={wrapperRef} className="w-full">
      {!viewport && (
        <div className="mx-auto aspect-[612/792] w-full animate-pulse bg-paper shadow-sheet motion-reduce:animate-none" />
      )}
      <div
        className={cn("relative mx-auto bg-paper shadow-sheet", !viewport && "hidden")}
        style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
          aria-label={t.pdfPage(pageNumber)}
          role="img"
        />
        {boxes.map(({ key, field, index, left, top, width: w, height: h }) => {
          const selected = field.id === selectedId;
          const seen = visited.has(field.id);
          const option = field.type === "radio" ? field.options?.[index] : undefined;
          const label = option ? `${field.label}: ${option}` : field.label;
          return (
            <button
              key={key}
              type="button"
              data-field-id={index === 0 ? field.id : undefined}
              title={label}
              aria-label={t.explainFieldAria(label, seen)}
              aria-pressed={selected}
              tabIndex={index === 0 ? 0 : -1}
              aria-hidden={index === 0 ? undefined : true}
              onClick={() => onSelect(field.id)}
              className={cn(
                "pr-ff",
                showFields && "is-marked",
                showFields && seen && "is-visited",
                (w < 30 || h < 14) && "is-small",
                selected && "is-selected",
              )}
              style={{ left, top, width: Math.max(w, 8), height: Math.max(h, 8) }}
            />
          );
        })}
      </div>
    </div>
  );
}
