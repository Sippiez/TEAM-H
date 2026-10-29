"use client";

import { ArrowRightIcon, CpuIcon, LanguagesIcon, LockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "cn";
import type { ChatMessage, FormField } from "@/lib/types";

import { englishOnly, useI18n } from "./i18n";
import { OverviewCard } from "./overview-card";
import { ResourceList } from "./resource-list";
import { RichText } from "./rich-text";
import { btnPrimary, chip, textInput } from "./styles";

interface ChatPanelProps {
  id: string;
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  onFieldRef?: (fieldId: string) => void;
  askingAbout?: FormField;
  onClearAsking?: () => void;
  suggestions: string[];
  placeholder: string;
  inputLabel: string;
  /** Optional heading block shown above the log. */
  heading?: { title: string; sub: string };
  logClassName?: string;
  className?: string;
}

export function ChatPanel({
  id,
  messages,
  pending,
  onSend,
  onFieldRef,
  askingAbout,
  onClearAsking,
  suggestions,
  placeholder,
  inputLabel,
  heading,
  logClassName,
  className,
}: ChatPanelProps) {
  const { lang, t } = useI18n();
  const en = englishOnly(lang);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (!log || log.scrollHeight <= log.clientHeight) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    log.scrollTo({ top: log.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value);
    setDraft("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {heading && (
        <div className="mx-4 border-b border-rule-2 pt-4 pb-3 sm:mx-5">
          <h2 id={`${id}-title`} className="text-[19px]">
            {heading.title}
          </h2>
          <p className="text-[15px] text-ink-2">{heading.sub}</p>
        </div>
      )}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-busy={pending}
        aria-label={heading ? undefined : t.conversation}
        aria-labelledby={heading ? `${id}-title` : undefined}
        tabIndex={0}
        className={cn("relative flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-4 py-4 text-[17px] sm:px-5", logClassName)}
      >
        {messages.length === 0 && !pending && (
          <p className="text-ink-2">{t.chatEmpty}</p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="max-w-[85%] self-end rounded-[10px_10px_2px_10px] bg-hover-wash px-3.5 py-2.5 whitespace-pre-wrap"
            >
              <span className="sr-only">{t.youAsked}</span>
              {m.text}
            </div>
          ) : (
            <article key={m.id} className="flex flex-col gap-2">
              <span className="sr-only">{t.answer}</span>
              {m.overview ? (
                <OverviewCard overview={m.overview} />
              ) : (
                <div lang={m.language ?? en}>
                  <RichText text={m.text} />
                </div>
              )}
              {m.overview && m.text && !m.text.startsWith(m.overview.summary) && (
                <div lang={m.language ?? en}>
                  <RichText text={m.text} />
                </div>
              )}
              {m.fieldRefs && m.fieldRefs.length > 0 && onFieldRef && (
                <div className="flex flex-wrap gap-1.5">
                  {m.fieldRefs.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onFieldRef(f.id)}
                      aria-label={t.showFieldReference(f.document, f.page, f.label)}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-ink bg-paper py-1 pr-3 pl-2.5 text-left text-[15px] font-semibold hover:bg-highlighter"
                    >
                      <span aria-hidden="true" className="size-3 flex-none rounded-full border-2 border-ink bg-paper" />
                      {f.label}
                      <span className="text-[13px] font-normal text-ink-2">
                        {f.document} · {t.page(f.page)}
                      </span>
                      <span className="sr-only">{t.showFieldSr}</span>
                    </button>
                  ))}
                </div>
              )}
              {m.resources && m.resources.length > 0 && <ResourceList resources={m.resources} className="mt-1" />}
            </article>
          ),
        )}
        {pending && <p className="py-1 text-ink-2 italic">{t.thinking}</p>}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-rule-2 px-4 pt-3 pb-2.5 sm:px-5">
          {suggestions.map((s) => (
            <button key={s} type="button" lang={en} className={chip} disabled={pending} onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className={cn("flex flex-col gap-2 bg-paper px-4 pb-3.5 sm:px-5", suggestions.length === 0 && "border-t border-rule-2 pt-3")}
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        {askingAbout && (
          <div className="flex items-center gap-2 rounded-md bg-highlighter py-1 pr-1 pl-3 text-[15px]">
            <span className="min-w-0 flex-1">
              {t.askingAbout} <b className="font-extrabold">{askingAbout.label}</b>
            </span>
            {onClearAsking && (
              <button
                type="button"
                onClick={onClearAsking}
                aria-label={t.stopAsking(askingAbout.label)}
                className="min-h-10 cursor-pointer rounded-sm border-[1.5px] border-ink bg-paper px-2.5 font-bold"
              >
                {t.clear}
              </button>
            )}
          </div>
        )}
        <label htmlFor={`${id}-input`} className="sr-only">
          {inputLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-input`}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            maxLength={1000}
            autoComplete="off"
            className={textInput}
          />
          <button type="submit" className={btnPrimary} disabled={pending || !draft.trim()}>
            {t.send}
            <ArrowRightIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-1 text-[15px] leading-[1.45] text-ink-2">
          {t.askInEnglish && (
            <p className="flex items-start gap-2">
              <LanguagesIcon className="mt-[0.15em] size-4 flex-none text-ink" strokeWidth={2.25} aria-hidden />
              {t.askInEnglish}
            </p>
          )}
          <p className="flex items-start gap-2">
            <LockIcon className="mt-[0.15em] size-4 flex-none text-ink" strokeWidth={2.25} aria-hidden />
            {t.labelsOnly}
          </p>
          <p className="flex items-start gap-2">
            <CpuIcon className="mt-[0.15em] size-4 flex-none text-ink" strokeWidth={2.25} aria-hidden />
            {t.rulesNotAi}
          </p>
        </div>
      </form>
    </div>
  );
}
