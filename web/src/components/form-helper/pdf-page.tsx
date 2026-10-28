"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import type { PDFDocumentProxy, PDFPageProxy } from "@/lib/pdf/pdfjs";
import type { FormField } from "@/lib/types";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  fields: FormField[];
  selectedId: string | null;
  visited: ReadonlySet<string>;
  showFields: boolean;
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
  onSelect,
}: PdfPageProps) {
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
    if (!selectedId || !viewport) return;
    const el = wrapperRef.current?.querySelector<HTMLElement>(`[data-field-id="${selectedId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [selectedId, viewport]);

  return (
    <div ref={wrapperRef} className="w-full">
      {!viewport && <Skeleton className="mx-auto aspect-[612/792] w-full max-w-3xl" />}
      <div
        className={cn("relative mx-auto bg-white shadow-sm ring-1 ring-black/10", !viewport && "hidden")}
        style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={viewport ? { width: viewport.width, height: viewport.height } : undefined}
          aria-label={`Page ${pageNumber} of the form`}
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
              aria-label={`Explain field: ${label}`}
              aria-pressed={selected}
              tabIndex={index === 0 ? 0 : -1}
              aria-hidden={index === 0 ? undefined : true}
              onClick={() => onSelect(field.id)}
              className={cn(
                "absolute cursor-pointer rounded-[3px] border transition-colors focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                showFields
                  ? seen
                    ? "border-emerald-600/50 bg-emerald-400/10 hover:bg-emerald-400/25"
                    : "border-sky-600/50 bg-sky-400/10 hover:bg-sky-400/25"
                  : "border-transparent hover:border-sky-600/50 hover:bg-sky-400/15",
                selected &&
                  "z-10 border-amber-500 bg-amber-300/35 ring-2 ring-amber-500/70 hover:bg-amber-300/45",
              )}
              style={{ left, top, width: Math.max(w, 8), height: Math.max(h, 8) }}
            />
          );
        })}
      </div>
    </div>
  );
}
