"use client";

import { ArrowRightIcon, CpuIcon, LanguagesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "cn";
import type { ChatMessage, FormField } from "@/lib/types";
import type { LookupContext } from "@/lib/official/catalog";

import { englishOnly, useI18n } from "./i18n";
import { OverviewCard } from "./overview-card";
import { LookupRecovery } from "./lookup-recovery";
import { ResourceList } from "./resource-list";
import { RichText } from "./rich-text";
import { btnPrimary, btnSecondary, chip, textInput } from "./styles";

interface ChatPanelProps {
  id: string;
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  onRetry?: (message: ChatMessage) => void;
  onResolve?: (message: ChatMessage, choice: LookupContext, label: string) => void;
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
  onRetry,
  onResolve,
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
  const followLatest = useRef(true);
  const showSuggestions = suggestions.length > 0 && !messages.some((message) => message.role === "user");

  useEffect(() => {
    const log = logRef.current;
    if (!log || !followLatest.current || log.scrollHeight <= log.clientHeight) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    log.scrollTo({ top: log.scrollHeight, behavior: reduce || pending ? "auto" : "smooth" });
  }, [messages, pending]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || pending) return;
    followLatest.current = true;
    onSend(value);
    setDraft("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col overflow-y-auto", className)}>
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
        onScroll={(event) => {
          const log = event.currentTarget;
          followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        }}
        className={cn("relative flex min-h-48 flex-1 flex-col gap-[18px] overflow-auto px-4 py-4 text-[17px] sm:px-5", logClassName)}
      >
        {messages.length === 0 && !pending && (
          <p className="text-ink-2">{t.chatEmpty}</p>
        )}
        {messages.map((m) => {
          const lookupStatus = m.lookup ? t.lookupStatus(m.lookup) : "";
          return m.role === "user" ? (
            <div
              key={m.id}
              className="pr-message-enter max-w-[85%] self-end rounded-[10px_10px_2px_10px] bg-hover-wash px-3.5 py-2.5 whitespace-pre-wrap"
            >
              <span className="sr-only">{t.youAsked}</span>
              {m.text}
            </div>
          ) : (
            <article key={m.id} className="pr-message-enter flex flex-col gap-2">
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
              {lookupStatus && (
                <p role="status" className="text-[15px] text-ink-2">
                  {lookupStatus}
                </p>
              )}
              {m.lookup?.restrictedDownload && (
                <p className="text-[15px] text-ink-2">{t.downloadRestricted}</p>
              )}
              {m.lookup && m.id === messages.at(-1)?.id && (
                <LookupRecovery
                  outcome={m.lookup}
                  disabled={pending}
                  onResolve={(choice, label) => {
                    followLatest.current = true;
                    onResolve?.(m, choice, label);
                    logRef.current?.focus({ preventScroll: true });
                  }}
                />
              )}
              {m.error && (
                <p role="alert" className="text-[15px] text-ink-2">
                  {m.error === "not_configured" ? t.aiNotConfigured : m.error === "timeout" ? t.chatTimeout : t.chatError}
                </p>
              )}
              {m.incomplete && m.text.trim() && (
                <p role="alert" className="text-[15px] font-semibold text-ink">
                  {t.incompleteAnswer}
                </p>
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
              {m.lookup?.method === "google_grounding" && m.lookup.searchSuggestionsHtml && (
                <iframe
                  title={t.googleSearchSuggestions}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  className="h-48 w-full border-0"
                  srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><base target="_blank">${m.lookup.searchSuggestionsHtml}`}
                />
              )}
              {m.id === messages.at(-1)?.id && m.request && onRetry && m.error !== "not_configured" &&
                m.lookup?.reason !== "provider_not_configured" &&
                (m.incomplete || m.error || m.lookup?.status === "unavailable" || m.lookup?.status === "no_verified_results") && (
                  <button
                    type="button"
                    className={`${btnSecondary} self-start`}
                    disabled={pending}
                    onClick={() => {
                      followLatest.current = true;
                      onRetry(m);
                      logRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    {t.tryAgain}
                  </button>
                )}
            </article>
          );
        })}
        {pending && <p role="status" className="py-1 text-ink-2 italic">{messages.at(-1)?.lookup?.status === "verified" ? t.preparingAnswer : t.thinking}</p>}
      </div>

      {showSuggestions && (
        <div className="flex flex-none flex-wrap gap-1.5 border-t border-rule-2 px-4 pt-3 pb-2.5 sm:px-5">
          {suggestions.map((s) => (
            <button key={s} type="button" className={chip} disabled={pending} onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className={cn("flex flex-none flex-col gap-2 bg-paper px-4 pb-3.5 sm:px-5", !showSuggestions && "border-t border-rule-2 pt-3")}
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
          <details>
            <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-ink">
              <CpuIcon className="mr-1.5 inline size-4 align-text-bottom" strokeWidth={2.25} aria-hidden />
              {t.aiPrivacyDetails}
            </summary>
            <p className="pb-1">{t.rulesNotAi}</p>
          </details>
        </div>
      </form>
    </div>
  );
}
