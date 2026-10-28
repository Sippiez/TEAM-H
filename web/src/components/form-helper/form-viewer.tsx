"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { FormField } from "@/lib/types";

import { PdfPage } from "./pdf-page";

interface FormViewerProps {
  doc: PDFDocumentProxy;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  fields: FormField[];
  selectedId: string | null;
  visited: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
}

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function FormViewer({
  doc,
  page,
  pageCount,
  onPageChange,
  fields,
  selectedId,
  visited,
  onSelect,
}: FormViewerProps) {
  const [zoomIndex, setZoomIndex] = useState(1);
  const [showFields, setShowFields] = useState(true);
  const pageFields = useMemo(() => fields.filter((f) => f.page === page), [fields, page]);
  const viewedOnPage = pageFields.filter((f) => visited.has(f.id)).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/40">
      <div className="flex flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5">
        <IconButton label="Previous page" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeftIcon />
        </IconButton>
        <span className="min-w-20 text-center text-sm tabular-nums" aria-live="polite">
          Page {page} of {pageCount}
        </span>
        <IconButton label="Next page" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          <ChevronRightIcon />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton label="Zoom out" onClick={() => setZoomIndex((z) => z - 1)} disabled={zoomIndex <= 0}>
          <ZoomOutIcon />
        </IconButton>
        <button
          type="button"
          className="min-w-12 rounded-md px-1 text-sm tabular-nums hover:bg-accent"
          onClick={() => setZoomIndex(1)}
          aria-label="Fit page to width"
          title="Fit to width"
        >
          {Math.round(ZOOMS[zoomIndex] * 100)}%
        </button>
        <IconButton
          label="Zoom in"
          onClick={() => setZoomIndex((z) => z + 1)}
          disabled={zoomIndex >= ZOOMS.length - 1}
        >
          <ZoomInIcon />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton label={showFields ? "Hide field highlights" : "Show field highlights"} onClick={() => setShowFields((s) => !s)}>
          {showFields ? <EyeIcon /> : <EyeOffIcon />}
        </IconButton>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          {pageFields.length} fields on this page · {viewedOnPage} viewed
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <PdfPage
          doc={doc}
          pageNumber={page}
          zoom={ZOOMS[zoomIndex]}
          fields={pageFields}
          selectedId={selectedId}
          visited={visited}
          showFields={showFields}
          onSelect={onSelect}
        />
        {pageFields.length === 0 && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            No fillable fields on this page. It may contain instructions.
          </p>
        )}
      </div>
    </div>
  );
}
