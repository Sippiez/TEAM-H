"use client";

import {
  CheckIcon,
  FileUpIcon,
  InfoIcon,
  LoaderCircleIcon,
  LockIcon,
  PencilIcon,
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

import { cn } from "cn";

import { getResources } from "@/lib/catalog/resources";
import { tokenize } from "@/lib/text";

import { useI18n } from "./i18n";
import { MarginaliaPreview } from "./marginalia-preview";
import { btnPaper, btnPrimary, textInput } from "./styles";

interface LandingProps {
  loading: boolean;
  onFile: (file: File) => void;
  onSample: () => void;
  mapHighlight?: readonly string[];
  navigator: ReactNode;
}

const noticeIcon = "mt-0.5 size-5 flex-none text-ink";
const services = getResources(["passports", "sin", "ei", "ccb", "cpp", "oas", "cra-sign-in"]);
const departments: Record<string, string> = {
  passports: "IRCC",
  sin: "ESDC",
  ei: "ESDC",
  ccb: "CRA",
  cpp: "ESDC",
  oas: "ESDC",
  "cra-sign-in": "CRA",
};

export function Landing({
  loading,
  onFile,
  onSample,
  mapHighlight,
  navigator,
}: LandingProps) {
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useI18n();
  const tokens = tokenize(query);
  const matches = services
    .map((resource) => {
      const words = tokenize([
        t.serviceIndex[resource.id],
        resource.title,
        resource.department,
        ...resource.tags,
      ].join(" "));
      return {
        resource,
        score: tokens.length ? tokens.filter((token) => words.includes(token)).length : 1,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);

    if (loading) return;

    const file = event.dataTransfer.files[0];

    if (file) {
      onFile(file);
    }
  }

  return (
    <main className="marginalia-landing">
      <div className="marginalia-landing-grid">
        {/* Hero and upload */}
        <div className="marginalia-pitch flex min-w-0 flex-col">
          <section aria-labelledby="hero-title" className="pt-1">
            <h1
              id="hero-title"
              tabIndex={-1}
              className="text-[clamp(2.1rem,2.9vw,2.85rem)] leading-[1.08] font-extrabold tracking-[-0.02em] focus:outline-none"
            >
              {t.heroTitle}
            </h1>

            <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
              {t.heroSub}
            </p>
          </section>

          <section aria-labelledby="start-title">
            <h2 id="start-title" className="sr-only">
              {t.startHere}
            </h2>

            <label
              onDragEnter={(event) => {
                event.preventDefault();
                if (!loading) setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();

                if (event.dataTransfer) {
                  event.dataTransfer.dropEffect = loading ? "none" : "copy";
                }

                if (!loading) setDragging(true);
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDragging(false);
                }
              }}
              onDrop={handleDrop}
              className={cn(
                "marginalia-drop group relative mt-7 flex cursor-pointer flex-col bg-paper px-7 py-7 shadow-sheet",
                "focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ink",
                dragging && "marginalia-drop-active",
                loading && "cursor-progress opacity-80",
              )}
            >
              <input
                type="file"
                aria-label={t.chooseFile}
                accept="application/pdf,.pdf"
                disabled={loading}
                className="sr-only"
                aria-describedby="upload-limits"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    onFile(file);
                  }

                  event.target.value = "";
                }}
              />

              {loading ? (
                <LoaderCircleIcon
                  className="size-9 animate-spin motion-reduce:animate-none"
                  strokeWidth={1.8}
                  aria-hidden
                />
              ) : (
                <FileUpIcon className="marginalia-upload-icon size-9" strokeWidth={1.8} aria-hidden />
              )}

              <strong className="mt-3 text-[22px] leading-tight font-extrabold">
                {loading ? t.reading : t.dropHint}
              </strong>

              <span className="mt-1 text-ink-2">{t.sourcesHint}</span>

              <span
                aria-hidden="true"
                className={cn(
                  btnPrimary,
                  "mt-4 min-h-11 self-start",
                )}
              >
                {loading ? t.reading : t.chooseFile}
              </span>
            </label>

            <ul
              id="upload-limits"
              className="mt-3 flex flex-wrap gap-x-[18px] gap-y-1 text-[15.5px] text-ink-2 tabular-nums"
            >
              {t.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>

            <p
              role="status"
              aria-live="polite"
              className={cn(
                "empty:hidden",
                loading &&
                  "mt-3 rounded-sm bg-status-wash px-3 py-2.5 font-bold",
              )}
            >
              {loading ? t.reading : ""}
            </p>
          </section>

          {/* Samples */}
          <section aria-labelledby="sample-title">
            <h2 id="sample-title" className="mt-8 text-[18px] font-extrabold">
              {t.sampleTitle}
            </h2>

            <button
              type="button"
              aria-label={t.openSampleAria}
              onClick={onSample}
              disabled={loading}
              className={cn(
                "mt-2.5 flex min-h-16 w-full flex-col items-start justify-center rounded-md border-[1.5px] border-ink bg-paper px-4 py-2.5 text-left shadow-card",
                "transition-colors duration-150 motion-reduce:transition-none hover:bg-highlighter focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <span lang="en" className="text-[15px] font-extrabold tabular-nums">
                PPTC 153
              </span>

              <span lang={t.htmlLang} className="text-[16px] leading-snug font-semibold">
                {t.sampleName}
              </span>
            </button>

            <p className="mt-3 flex items-start gap-2 text-[15.5px] font-bold">
              <CheckIcon
                className="mt-0.5 size-5 flex-none"
                strokeWidth={2.5}
                aria-hidden
              />
              {t.supported}
            </p>
          </section>

          {/* Footnotes */}
          <aside
            aria-label={t.importantInformation}
            className="relative mt-7 flex flex-col gap-2 pt-4 text-[15.5px] leading-relaxed text-ink-2 before:absolute before:top-0 before:left-0 before:w-[72px] before:border-t-[1.5px] before:border-ink"
          >
            <p className="flex items-start gap-2.5">
              <LockIcon className={noticeIcon} strokeWidth={2.25} aria-hidden />

              <span>
                <strong className="font-bold text-ink">{t.privacyLead}</strong>{" "}
                {t.privacyRest}
              </span>
            </p>

            <p className="flex items-start gap-2.5">
              <PencilIcon
                className={noticeIcon}
                strokeWidth={2.15}
                aria-hidden
              />
              {t.rulesNotAi}
            </p>
          </aside>
        </div>

        <figure className="marginalia-sample min-w-0">
          <MarginaliaPreview />

          <figcaption className="mt-7 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2">
            {t.sampleCaption}
          </figcaption>
        </figure>
      </div>

      <section
        aria-labelledby="finder-title"
        className="marginalia-service grid items-start gap-8 border-t border-rule pt-10"
      >
        <div className="flex flex-col gap-2.5">
          <h2
            id="finder-title"
            className="text-[24px] leading-tight font-extrabold tracking-[-0.015em] sm:text-[28px]"
          >
            {t.finderTitle}
          </h2>

          <p className="max-w-[46ch] text-ink-2">{t.finderSub}</p>

          <form
            role="search"
            className="mt-2.5 flex flex-col gap-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor="service-search" className="font-bold">{t.searchServices}</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="service-search"
                type="search"
                autoComplete="off"
                placeholder={t.serviceSearchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-controls="service-index"
                className={cn(textInput, "min-w-0 flex-[1_1_220px]")}
              />
              <button type="submit" className={btnPaper}>{t.findServices}</button>
            </div>
          </form>
        </div>

        <nav aria-labelledby="finder-title">
          <ul id="service-index" className="marginalia-service-index">
            {matches.map(({ resource }) => {
              const suggested = mapHighlight?.some((id) =>
                id === resource.id ||
                (resource.id === "passports" && id.startsWith("passport")) ||
                (resource.id === "ei" && id.startsWith("ei-")) ||
                (resource.id === "cra-sign-in" && ["income-tax", "cra-forms"].includes(id)),
              );
              return (
                <li key={resource.id}>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    <span className={cn("marginalia-service-name", suggested && "font-extrabold")}>
                      {t.serviceIndex[resource.id]}
                    </span>
                    <span className="marginalia-service-leader" aria-hidden="true" />
                    <span lang="en" className="marginalia-service-department">
                      {departments[resource.id]}
                    </span>
                    <span className="sr-only">
                      {suggested ? t.suggested : ""}
                      {t.opensNewTab}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <p role="status" className={cn(matches.length ? "sr-only" : "py-3 text-ink-2")}>
            {matches.length ? (query ? t.serviceResults(matches.length) : "") : t.noServiceMatch}
          </p>
        </nav>
      </section>

      <details className="marginalia-navigator mt-8 border-t border-rule pt-5">
        <summary className="min-h-11 cursor-pointer py-2 text-[19px] font-bold">
          {t.askServiceNavigator}
        </summary>
        <div className="mt-4 flex h-[min(620px,85dvh)] min-h-[440px] flex-col overflow-hidden bg-paper shadow-card">
          {navigator}
        </div>
      </details>

      <footer className="mt-14">
        <p className="flex max-w-[80ch] items-start gap-2.5 text-[15.5px] text-ink-2">
          <InfoIcon className={noticeIcon} strokeWidth={2.25} aria-hidden />
          {t.footer}
        </p>
      </footer>
    </main>
  );
}
