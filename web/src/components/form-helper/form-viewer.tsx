"use client";

import { ArrowLeftIcon, ArrowRightIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "cn";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { FormField } from "@/lib/types";

import { useI18n } from "./i18n";
import { PdfPage } from "./pdf-page";

export interface DocTab {
  key: string;
  fileName: string;
  formNumber?: string;
}

interface FormViewerProps {
  doc: PDFDocumentProxy;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  fields: FormField[];
  selectedId: string | null;
  visited: ReadonlySet<string>;
  scrollKey: number;
  loading: boolean;
  onSelect: (fieldId: string) => void;
  onFile: (file: File) => void;
  docs: DocTab[];
  activeKey: string;
  maxDocs: number;
  onSwitch: (key: string) => void;
  onClose: (key: string) => void;
}

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];
const MAX_STOPS = 12;

const tool =
  "inline-grid size-11 cursor-pointer place-items-center rounded-md border-[1.5px] border-quiet-stroke bg-paper text-ink hover:border-ink hover:bg-hover-wash disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-quiet-stroke disabled:hover:bg-paper";

const ghost =
  "inline-grid size-11 cursor-pointer place-items-center rounded-sm text-ink hover:bg-hover-wash disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent";

export const docName = (d: DocTab) => (d.formNumber ? `${d.formNumber} ${d.fileName}` : d.fileName);

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The file name without ".pdf", or nothing when it only repeats the form number. */
function tabSubtitle(d: DocTab) {
  const base = d.fileName.replace(/\.pdf$/i, "");
  return d.formNumber && squash(base) === squash(d.formNumber) ? "" : base;
}

export function FormViewer({
  doc,
  page,
  pageCount,
  onPageChange,
  fields,
  selectedId,
  visited,
  scrollKey,
  loading,
  onSelect,
  onFile,
  docs,
  activeKey,
  maxDocs,
  onSwitch,
  onClose,
}: FormViewerProps) {
  const { t } = useI18n();
  const [zoomIndex, setZoomIndex] = useState(1);
  const [showFields, setShowFields] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageFields = useMemo(() => fields.filter((f) => f.page === page), [fields, page]);
  const pagesWithFields = useMemo(() => new Set(fields.map((f) => f.page)), [fields]);
  const active = docs.find((d) => d.key === activeKey);
  const full = docs.length >= maxDocs;

  return (
    <section
      aria-labelledby="doc-title"
      className="relative min-w-0 bg-desk px-3 pt-3 pb-6 desk:overflow-auto desk:px-8 desk:pt-[18px] desk:pb-10"
    >
      <h2 id="doc-title" className="sr-only">
        {active ? (active.formNumber ? `${active.formNumber} ? ${active.fileName}` : active.fileName) : ""}
      </h2>
      <div className="@container z-10 mx-auto flex max-w-[780px] flex-col gap-2.5 rounded-md bg-paper px-3.5 pt-3 pb-3 shadow-card desk:sticky desk:top-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 @min-[34rem]:flex-nowrap">
          <ul
            aria-label={t.docTabsLabel}
            className="-m-1.5 flex min-w-0 flex-1 basis-full gap-2 overflow-x-auto p-1.5 @min-[34rem]:basis-0"
          >
            {docs.map((d) => {
              const on = d.key === activeKey;
              return (
                <li
                  key={d.key}
                  className={cn(
                    "flex min-h-11 max-w-[17rem] min-w-[8.5rem] shrink items-stretch rounded-md border text-[15px]",
                    on
                      ? "border-ink bg-paper text-ink shadow-[inset_0_-3px_0_var(--color-highlighter)]"
                      : "border-rule bg-hover-wash text-ink-2 hover:border-ink",
                  )}
                >
                  <button
                    type="button"
                    data-doc-tab={d.key}
                    aria-current={on ? "true" : undefined}
                    onClick={() => onSwitch(d.key)}
                    title={docName(d)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 pr-1 pl-3"
                  >
                    {d.formNumber && (
                      <span className="font-extrabold whitespace-nowrap text-ink tabular-nums">{d.formNumber}</span>
                    )}
                    {(tabSubtitle(d) || !d.formNumber) && (
                      <span className="min-w-0 truncate">{tabSubtitle(d) || d.fileName}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={t.closeDoc(docName(d))}
                    onClick={() => onClose(d.key)}
                    className={cn(
                      "grid w-10 flex-none cursor-pointer place-items-center rounded-md text-ink-2 hover:text-ink",
                      on ? "hover:bg-hover-wash" : "hover:bg-paper",
                    )}
                  >
                    <XIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="ml-auto flex flex-none items-center gap-3">
            <p className="text-[15px] whitespace-nowrap text-ink-2 tabular-nums">{t.docCount(docs.length, maxDocs)}</p>
            <button
              type="button"
              id="add-pdf"
              disabled={loading || full}
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-dashed border-control-stroke px-3 text-[15px] font-bold whitespace-nowrap hover:border-ink hover:bg-hover-wash disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-control-stroke disabled:hover:bg-transparent"
            >
              <PlusIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
              {loading ? t.opening : t.addPdf}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </div>
        <nav
          aria-label={t.pages}
          className="flex flex-col items-stretch gap-2 border-t border-rule-2 pt-2.5 sm:flex-row sm:items-center sm:gap-4"
        >
          <p className="min-w-[6.5em] text-[15.5px] font-bold whitespace-nowrap tabular-nums" aria-live="polite">
            {t.pageOf(page, pageCount)}
          </p>
          {pageCount <= MAX_STOPS ? (
            <ol className="pr-stops">
              {Array.from({ length: pageCount }, (_, k) => k + 1).map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    className={cn("pr-stop", pagesWithFields.has(n) && "has-fields")}
                    aria-current={n === page ? "page" : undefined}
                    aria-label={t.pageStop(n, pageCount, pagesWithFields.has(n))}
                    onClick={() => onPageChange(n)}
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                className={tool}
                aria-label={t.prevPage}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ArrowLeftIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
              </button>
              <button
                type="button"
                className={tool}
                aria-label={t.nextPage}
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                <ArrowRightIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          )}
        </nav>
      </div>
      {pageFields.length === 0 && (
        <p className="mx-auto mt-2.5 max-w-[780px] rounded-sm bg-status-wash px-3.5 py-2.5 font-bold" role="status">
          {t.noFieldsOnPage}
        </p>
      )}
      {/* The view toolbar comes before the sheet in focus order but floats at the bottom of it. */}
      <div className="mx-auto mt-[22px] flex max-w-[780px] flex-col">
        <div
          role="group"
          aria-label={t.viewTools}
          className="sticky bottom-3 z-10 order-last mt-4 flex items-center gap-0.5 self-center rounded-md border border-rule bg-paper p-1 shadow-sheet desk:bottom-5"
        >
          <button
            type="button"
            className={ghost}
            aria-label={t.zoomOut}
            disabled={zoomIndex <= 0}
            onClick={() => setZoomIndex((z) => z - 1)}
          >
            <MinusIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className="min-h-11 min-w-[4.25rem] cursor-pointer rounded-sm px-1 text-[15px] font-bold tabular-nums hover:bg-hover-wash"
            onClick={() => setZoomIndex(1)}
            aria-label={t.zoomReset(Math.round(ZOOMS[zoomIndex] * 100))}
          >
            {Math.round(ZOOMS[zoomIndex] * 100)}%
          </button>
          <button
            type="button"
            className={ghost}
            aria-label={t.zoomIn}
            disabled={zoomIndex >= ZOOMS.length - 1}
            onClick={() => setZoomIndex((z) => z + 1)}
          >
            <PlusIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
          <span aria-hidden="true" className="mx-1.5 h-7 w-px flex-none bg-rule" />
          <button
            type="button"
            aria-pressed={showFields}
            onClick={() => setShowFields((s) => !s)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[15px] font-bold whitespace-nowrap hover:bg-hover-wash"
          >
            <span
              aria-hidden="true"
              className={cn("grid size-[18px] place-items-center rounded-sm border-2 border-ink", showFields && "bg-ink")}
            >
              {showFields && (
                <svg viewBox="0 0 24 24" className="size-3.5 stroke-paper" fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            {t.outlineFields}
          </button>
        </div>
        <div className="w-full overflow-x-auto pb-2 desk:overflow-visible">
          <PdfPage
            doc={doc}
            pageNumber={page}
            zoom={ZOOMS[zoomIndex]}
            fields={pageFields}
            selectedId={selectedId}
            visited={visited}
            showFields={showFields}
            scrollKey={scrollKey}
            onSelect={onSelect}
          />
        </div>
      </div>
    </section>
  );
}
