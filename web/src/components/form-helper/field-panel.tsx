"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CircleXIcon, InfoIcon, LocateFixedIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "cn";
import type { FieldExplanation, FormField } from "@/lib/types";

import { englishOnly, useI18n } from "./i18n";
import { ResourceList } from "./resource-list";
import { btnPaper, btnPrimary, btnSecondary } from "./styles";

const icon = "size-[18px] flex-none";

interface FieldPanelProps {
  fields: FormField[];
  pageCount: number;
  selected?: FormField;
  explanation?: FieldExplanation;
  explanationError?: boolean;
  onSelect: (fieldId: string) => void;
  onAsk: (field: FormField) => void;
  onRetry: (field: FormField) => void;
  onShowOnForm: () => void;
}

export function FieldPanel({
  fields,
  pageCount,
  selected,
  explanation,
  explanationError,
  onSelect,
  onAsk,
  onRetry,
  onShowOnForm,
}: FieldPanelProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const stepped = useRef<-1 | 1 | null>(null);

  const index = selected ? fields.findIndex((f) => f.id === selected.id) : -1;
  const prev = index > 0 ? fields[index - 1] : undefined;
  const next = index >= 0 ? fields[index + 1] : undefined;

  useEffect(() => {
    const dir = stepped.current;
    stepped.current = null;
    if (!dir) return;
    const btn = dir === 1 ? nextRef.current : prevRef.current;
    if (!btn || btn.disabled) headingRef.current?.focus();
  }, [selected?.id]);

  if (!selected) {
    return (
      <div className="flex flex-col items-start gap-4 px-4 py-6 sm:px-6">
        <h2 className="max-w-[30ch] text-[19px] font-semibold text-ink-2">
          {t.selectPrompt}
        </h2>
        {fields[0] && (
          <button type="button" className={btnPrimary} onClick={() => onSelect(fields[0].id)}>
            {t.startFirst}
            <ArrowRightIcon className={icon} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>
    );
  }

  const step = (dir: -1 | 1, target?: FormField) => {
    if (!target) return;
    stepped.current = dir;
    onSelect(target.id);
  };

  return (
    <div>
      <div className="mx-4 flex flex-col gap-3 border-b border-rule-2 pt-[18px] pb-4 sm:mx-6 sm:pt-[22px] sm:pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-ink-2">
          <span>{selected.section}</span>
          <span className="tabular-nums">
            {t.pageOf(selected.page, pageCount)} · {t.types[selected.type]}
          </span>
        </div>
        <h2
          ref={headingRef}
          id="field-title"
          tabIndex={-1}
          className="text-[23px] tracking-[-0.01em] focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ink sm:text-[27px]"
        >
          <span className="pr-hl">{selected.label}</span>
          {selected.required && (
            <span className="ml-2 inline-flex align-middle rounded-sm border border-ink px-2 py-0.5 text-[13px] font-bold tracking-normal">
              {t.required}
            </span>
          )}
        </h2>
        {selected.tooltip && selected.tooltip !== selected.label && (
          <p className="text-[15px] text-ink-2">
            {t.pdfLabel} <q>{selected.tooltip}</q>
          </p>
        )}
        <div className="mt-1 grid gap-2 sm:grid-cols-[auto_1fr]">
          <button
            ref={prevRef}
            type="button"
            disabled={!prev}
            aria-label={prev ? t.prevFieldAria(prev.label) : undefined}
            onClick={() => step(-1, prev)}
            className={cn(btnSecondary, "justify-start px-3.5 py-2 text-[15.5px] leading-tight")}
          >
            <ArrowLeftIcon className={icon} strokeWidth={2.25} aria-hidden />
            {t.previous}
          </button>
          <button
            ref={nextRef}
            type="button"
            disabled={!next}
            onClick={() => step(1, next)}
            className={cn(btnPrimary, "justify-between px-3.5 py-2 text-left text-[15.5px] leading-tight")}
          >
            {next ? (
              <span>
                <span className="font-semibold text-ink-2">{t.nextLabel}</span> {next.label}
              </span>
            ) : (
              <span>{t.lastField}</span>
            )}
            <ArrowRightIcon className={icon} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        <button type="button" onClick={onShowOnForm} className={cn(btnSecondary, "min-h-11 self-start desk:hidden")}>
          <LocateFixedIcon className={icon} strokeWidth={2.25} aria-hidden />
          {t.showOnForm}
        </button>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-8 sm:px-6 sm:pt-[18px] desk:pb-24" aria-live="polite" aria-busy={!explanation && !explanationError}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {explanation &&
            (explanation.grounded ? (
              <p className="inline-flex items-center gap-2 text-[15.5px] text-ink-2">
                <CheckIcon className={cn(icon, "text-ink")} strokeWidth={2.5} aria-hidden />
                {t.grounded}
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 text-[15.5px] italic">
                <TriangleAlertIcon className={icon} strokeWidth={2.25} aria-hidden />
                {t.general}
              </p>
            ))}
          <button type="button" onClick={() => onAsk(selected)} className={cn(btnPaper, "ml-auto min-h-10 px-3 text-[15px]")}>
            <InfoIcon className={icon} strokeWidth={2.25} aria-hidden />
            {t.askField}
          </button>
        </div>

        {explanationError ? (
          <div className="flex flex-wrap items-center gap-3 rounded-sm bg-status-wash px-3.5 py-2.5" role="alert">
            <p className="font-bold">{t.explainError}</p>
            <button type="button" className={cn(btnPaper, "min-h-10 px-3 text-[15px]")} onClick={() => onRetry(selected)}>
              {t.tryAgain}
            </button>
          </div>
        ) : !explanation ? (
          <div className="flex flex-col gap-3">
            <span className="sr-only">{t.loadingExplanation}</span>
            {["w-1/3", "w-full", "w-5/6", "w-1/3", "w-full"].map((w, i) => (
              <div key={i} aria-hidden="true" className={cn("h-4 animate-pulse rounded-sm bg-rule-2 motion-reduce:animate-none", w)} />
            ))}
          </div>
        ) : (
          <Explanation field={selected} e={explanation} />
        )}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[17px]">{title}</h3>
      {children}
    </section>
  );
}

function Explanation({ field, e }: { field: FormField; e: FieldExplanation }) {
  const { lang, t } = useI18n();
  const en = englishOnly(lang);
  const options = field.options && field.options.length > 0 && field.options.length <= 12 ? field.options : null;
  return (
    <>
      {t.englishContent && <p className="text-[15.5px] text-ink-2 italic">{t.englishContent}</p>}
      <Block title={t.meaning}>
        <p lang={en} className="max-w-[62ch]">
          {e.meaning}
        </p>
      </Block>
      <Block title={t.enter}>
        <p lang={en} className="max-w-[62ch]">
          {e.whatToEnter}
        </p>
      </Block>
      {e.formatExample && (
        <Block title={t.example}>
          <p className="inline-block rounded-sm border border-rule bg-paper px-2.5 py-0.5 text-[19px] font-bold tabular-nums">
            {e.formatExample}
          </p>
        </Block>
      )}
      {options && (
        <Block title={t.options}>
          <ul className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <li key={o} className="rounded-sm border border-rule px-2.5 py-0.5 font-semibold">
                {o}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {e.whereToFind && (
        <Block title={t.whereToFind}>
          <p lang={en} className="max-w-[62ch]">{e.whereToFind}</p>
        </Block>
      )}
      {e.keyPoints && (
        <section lang={en} className="rounded-md border border-rule px-4 py-3">
          <h3 className="mb-1.5 text-[17px]">{e.keyPoints.title}</h3>
          <ul className="flex flex-col gap-1.5">
            {e.keyPoints.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckIcon className={cn(icon, "mt-[0.2em]")} strokeWidth={2.5} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {e.commonMistakes.length > 0 && (
        <Block title={t.mistakes}>
          <ul lang={en} className="flex flex-col gap-1.5">
            {e.commonMistakes.map((m) => (
              <li key={m} className="flex items-start gap-2.5">
                <CircleXIcon className={cn(icon, "mt-[0.2em]")} strokeWidth={2.25} aria-hidden />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {e.sources.length > 0 && (
        <Block title={t.sources}>
          <ResourceList resources={e.sources} compact />
        </Block>
      )}
    </>
  );
}
