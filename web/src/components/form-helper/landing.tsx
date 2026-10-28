"use client";

import { ArrowRightIcon, CheckIcon, CpuIcon, FileUpIcon, InfoIcon, LoaderCircleIcon, LockIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "cn";

import { useI18n } from "./i18n";
import { ServiceMap } from "./service-map";
import { btnPrimary } from "./styles";

interface LandingProps {
  loading: boolean;
  onFile: (file: File) => void;
  onSample: () => void;
  navigator: ReactNode;
  mapHighlight?: readonly string[];
}

const noticeIcon = "mt-0.5 size-5 flex-none text-ink";

export function Landing({ loading, onFile, onSample, navigator, mapHighlight }: LandingProps) {
  const [dragging, setDragging] = useState(false);
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 pb-28 sm:px-7 sm:pt-10 sm:pb-30">
      <div className="grid items-start gap-8 wide:grid-cols-[5fr_7fr] wide:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="hero-title" className="pt-1">
            <h1 id="hero-title" tabIndex={-1} className="focus:outline-none text-[clamp(2.15rem,3vw,2.9rem)] leading-[1.08] tracking-[-0.02em]">
              {t.heroTitle}
            </h1>
            <p className="mt-4 max-w-[42ch] text-[17px] text-ink-2 sm:text-[19px]">
              {t.heroSub}
            </p>
          </section>

          <section aria-labelledby="start-title" className="flex flex-col bg-paper shadow-sheet">
            <h2 id="start-title" className="px-4 pt-4 text-[19px] sm:px-6 sm:pt-[18px]">
              {t.startHere}
            </h2>
            <div className="flex flex-col gap-3.5 px-4 pt-3 pb-[18px] sm:px-6 sm:pt-3.5 sm:pb-6">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file && !loading) onFile(file);
                }}
                className={cn(
                  "group relative grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-0.5 rounded-sm border-[1.5px] border-dashed border-quiet-stroke bg-paper p-[22px] hover:border-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink",
                  dragging && "border-ink bg-status-wash",
                  loading && "cursor-progress",
                )}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={loading}
                  className="absolute size-px opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFile(file);
                    e.target.value = "";
                  }}
                />
                {loading ? (
                  <LoaderCircleIcon className="row-span-2 size-8 animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden />
                ) : (
                  <FileUpIcon className="row-span-2 size-8" strokeWidth={2} aria-hidden />
                )}
                <strong className="text-[19px] leading-tight font-extrabold">
                  {loading ? t.reading : t.dropHint}
                </strong>
                <span className="text-ink-2">{t.sourcesHint}</span>
              </label>
              <ul className="flex flex-wrap gap-x-[18px] gap-y-0.5 text-[15.5px] text-ink-2 tabular-nums">
                {t.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p role="status" className={cn("empty:hidden", loading && "rounded-sm bg-status-wash px-3 py-2.5 font-bold")}>
                {loading ? t.reading : ""}
              </p>
              <p className="flex items-start gap-2 text-[15.5px] font-bold">
                <CheckIcon className="mt-0.5 size-5 flex-none" strokeWidth={2.5} aria-hidden />
                {t.supported}
              </p>
              <p className="relative mt-0.5 flex items-start gap-2.5 pt-4 text-[15.5px] text-ink-2 before:absolute before:top-0 before:left-0 before:w-18 before:border-t-[1.5px] before:border-ink">
                <LockIcon className={noticeIcon} strokeWidth={2.25} aria-hidden />
                <span>
                  <b className="font-bold text-ink">{t.privacyLead}</b> {t.privacyRest}
                </span>
              </p>
              <p className="flex items-start gap-2.5 text-[15.5px] text-ink-2">
                <CpuIcon className={noticeIcon} strokeWidth={2.25} aria-hidden />
                {t.rulesNotAi}
              </p>
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-8 wide:flex-col-reverse wide:justify-end">
          <section aria-labelledby="board-title" className="bg-paper px-4 pt-[18px] pb-1.5 shadow-card sm:px-6 sm:pt-[22px] sm:pb-2">
            <h2 id="board-title" className="pb-3 text-[19px]">
              {t.sampleTitle}
            </h2>
            <ul>
              <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-rule-2 py-3.5 [grid-template-areas:'code_lang'_'title_title'_'open_open'] sm:grid-cols-[6.5rem_1fr_auto_auto] sm:[grid-template-areas:'code_title_lang_open']">
                <span className="text-[17px] font-extrabold tabular-nums [grid-area:code]">PPTC 153</span>
                <span className="text-[19px] leading-[1.3] font-semibold [grid-area:title]">{t.sampleName}</span>
                <abbr
                  title={t.sampleLangTitle}
                  className="justify-self-end rounded-sm border-[1.5px] border-ink px-[7px] text-[15px] font-bold no-underline [grid-area:lang]"
                >
                  EN
                </abbr>
                <button
                  type="button"
                  onClick={onSample}
                  disabled={loading}
                  aria-label={t.openSampleAria}
                  className={cn(btnPrimary, "min-h-11 [grid-area:open]")}
                >
                  {t.openSample}
                  <ArrowRightIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
                </button>
              </li>
            </ul>
          </section>

          <ServiceMap highlight={mapHighlight} />
        </div>
      </div>

      <section
        aria-labelledby="finder-title"
        className="mt-16 grid items-start gap-8 border-t border-rule pt-10 sm:mt-24 wide:grid-cols-[5fr_7fr] wide:gap-10"
      >
        <div className="flex flex-col gap-2.5">
          <h2 id="finder-title" className="text-[23px] tracking-[-0.01em] sm:text-[27px]">
            {t.finderTitle}
          </h2>
          <p className="max-w-[46ch] text-ink-2">{t.finderSub}</p>
        </div>
        <div className="flex h-[min(620px,85dvh)] min-h-[440px] flex-col bg-paper shadow-card">{navigator}</div>
      </section>

      <footer className="mt-14">
        <p className="flex max-w-[80ch] items-start gap-2.5 text-[15.5px] text-ink-2">
          <InfoIcon className={noticeIcon} strokeWidth={2.25} aria-hidden />
          {t.footer}
        </p>
      </footer>
    </div>
  );
}
