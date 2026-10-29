"use client";

import { InfoIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { cn } from "cn";
import { useMediaQuery } from "@/hooks/use-media-query";
import { loadForm, type LoadedForm } from "@/lib/pdf/extract";
import type { ChatMessage, FieldExplanation, FormContext, FormField } from "@/lib/types";

import { ChatPanel } from "./chat-panel";
import { FieldPanel } from "./field-panel";
import { FormViewer } from "./form-viewer";
import { setLang, useI18n } from "./i18n";
import { Landing } from "./landing";
import { Route } from "./route";
import { btnSecondary } from "./styles";
import { WorkspacePanels } from "./workspace-panels";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DOCS = 5;
const SAMPLE = { url: "/forms/pptc153.pdf", name: "pptc153.pdf" };

const NAVIGATOR_SUGGESTIONS = [
  "How do I renew my passport?",
  "I lost my job. What can I apply for?",
  "Sign in to my CRA account",
];

/** Where a selection came from. Clicks on the sheet itself never scroll the sheet. */
type Origin = "sheet" | "route" | "step" | "ref" | "reply";
type Tab = "field" | "ask";

function toContext(form: LoadedForm): FormContext {
  return {
    formNumber: form.formNumber,
    fileName: form.fileName,
    pageCount: form.pageCount,
    fields: form.fields.map(({ id, path, page, type, label, section, options }) => ({
      id,
      path,
      page,
      type,
      label,
      section,
      options,
    })),
  };
}

interface DocSession {
  key: string;
  form: LoadedForm;
  size: number;
  page: number;
  selectedId: string | null;
  visited: ReadonlySet<string>;
  explanations: Record<string, FieldExplanation>;
  explainErrors: ReadonlySet<string>;
  messages: ChatMessage[];
  pending: boolean;
  ctxCleared: boolean;
  tab: Tab;
}

type Target = { key: string; form: LoadedForm };

const nextId = () => `m-${crypto.randomUUID()}`;

export function FormHelperApp() {
  const isDesktop = useMediaQuery("(min-width: 1081px)");
  const { t, lang } = useI18n();
  const [docs, setDocs] = useState<DocSession[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrollKey, setScrollKey] = useState(0);
  const [navMessages, setNavMessages] = useState<ChatMessage[]>([]);
  const [navPending, setNavPending] = useState(false);
  const activeRef = useRef<string | null>(null);
  const requested = useRef(new Set<string>());
  const sideRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ field: null, ask: null });
  const navMessagesRef = useRef<ChatMessage[]>([]);
  const docsRef = useRef<DocSession[]>([]);
  const chatRequests = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const requests = chatRequests.current;
    return () => {
      for (const controller of requests.values()) controller.abort();
      requests.clear();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t.htmlLang]);

  useEffect(() => {
    navMessagesRef.current = navMessages;
  }, [navMessages]);

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  const active = docs.find((d) => d.key === activeKey) ?? null;
  const form = active?.form ?? null;
  const selected = active?.form.fields.find((f) => f.id === active.selectedId);

  const activate = (key: string | null) => {
    activeRef.current = key;
    setActiveKey(key);
  };

  const updateDoc = useCallback((key: string, fn: (d: DocSession) => DocSession) => {
    setDocs((ds) => ds.map((d) => (d.key === key ? fn(d) : d)));
  }, []);

  const revealSide = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sideRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, []);

  const loadExplanation = useCallback(
    async (key: string, field: FormField, formNumber?: string) => {
      requested.current.add(`${key}:${field.id}`);
      updateDoc(key, (d) => {
        if (!d.explainErrors.has(field.id)) return d;
        const next = new Set(d.explainErrors);
        next.delete(field.id);
        return { ...d, explainErrors: next };
      });
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: { id: field.id, path: field.path, page: field.page, type: field.type, label: field.label, section: field.section, options: field.options },
            formNumber,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FieldExplanation;
        updateDoc(key, (d) => ({ ...d, explanations: { ...d.explanations, [field.id]: data } }));
      } catch {
        requested.current.delete(`${key}:${field.id}`);
        updateDoc(key, (d) => ({ ...d, explainErrors: new Set(d.explainErrors).add(field.id) }));
      }
    },
    [updateDoc],
  );

  const selectField = useCallback(
    (target: Target, id: string, origin: Origin) => {
      const field = target.form.fields.find((f) => f.id === id);
      if (!field) return;
      updateDoc(target.key, (d) => ({
        ...d,
        selectedId: id,
        page: field.page,
        ctxCleared: false,
        visited: d.visited.has(id) ? d.visited : new Set(d.visited).add(id),
        tab: origin === "reply" ? d.tab : "field",
      }));
      if (!requested.current.has(`${target.key}:${id}`)) void loadExplanation(target.key, field, target.form.formNumber);
      if (target.key !== activeRef.current) return;
      if (isDesktop) {
        if (origin !== "sheet") setScrollKey((k) => k + 1);
      } else if (origin === "sheet" || origin === "route") {
        revealSide();
      }
    },
    [isDesktop, loadExplanation, revealSide, updateDoc],
  );

  /** Posts to the assistant. A null target is the landing page's service navigator. */
  const sendChat = useCallback(
    async (
      text: string | null,
      target: Target | null,
      fieldId: string | null,
      intent?: "overview",
    ) => {
      const requestKey = target?.key ?? "navigator";
      if (chatRequests.current.has(requestKey)) return;
      const controller = new AbortController();
      chatRequests.current.set(requestKey, controller);
      const isCurrent = () => chatRequests.current.get(requestKey) === controller;
      const currentMessages = target
        ? docsRef.current.find((doc) => doc.key === target.key)?.messages ?? []
        : navMessagesRef.current;

      const push = (message: ChatMessage) => {
        if (!isCurrent()) return;
        const msg = { ...message, language: lang };
        return target
          ? updateDoc(target.key, (doc) => ({
              ...doc,
              messages: [...doc.messages, msg],
            }))
          : setNavMessages((messages) => [
              ...messages,
              msg,
            ]);
      };

      const updateMessage = (
        messageId: string,
        text: string,
      ) => {
        if (!isCurrent()) return;
        return target
          ? updateDoc(target.key, (doc) => ({
              ...doc,
              messages: doc.messages.map((message) =>
                message.id === messageId
                  ? { ...message, text }
                  : message,
              ),
            }))
          : setNavMessages((messages) =>
              messages.map((message) =>
                message.id === messageId
                  ? { ...message, text }
                  : message,
              ),
            );
      };

      const removeMessage = (messageId: string) => {
        if (!isCurrent()) return;
        return target
          ? updateDoc(target.key, (doc) => ({
              ...doc,
              messages: doc.messages.filter(
                (message) => message.id !== messageId,
              ),
            }))
          : setNavMessages((messages) =>
              messages.filter(
                (message) => message.id !== messageId,
              ),
            );
      };

      const setPending = (pending: boolean) =>
        target
          ? updateDoc(target.key, (doc) => ({
              ...doc,
              pending,
            }))
          : setNavPending(pending);

      const history = currentMessages
        .filter(
          (message) =>
            message.role === "user" ||
            message.role === "assistant",
        )
        .slice(-12)
        .map((message) => ({
          role: message.role,
          text: message.text,
        }));

      if (text) {
        push({
          id: nextId(),
          role: "user",
          text,
        });
      }

      const assistantMessageId = nextId();

      push({
        id: assistantMessageId,
        role: "assistant",
        text: "",
      });

      setPending(true);

      const timeout = window.setTimeout(
        () => controller.abort(),
        30_000,
      );

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            message: text ?? undefined,
            intent,
            form: target
              ? toContext(target.form)
              : undefined,
            selectedFieldId: fieldId ?? undefined,
            history,
            language: lang,
          }),
        });

        if (!res.ok) {
          const payload = (await res
            .json()
            .catch(() => null)) as
            | { error?: string }
            | null;

          throw new Error(
            payload?.error || `HTTP ${res.status}`,
          );
        }

        if (!res.body) {
          throw new Error(
            "The server returned no response stream",
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let completeText = "";

        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          completeText += decoder.decode(value, {
            stream: true,
          });

          updateMessage(
            assistantMessageId,
            completeText,
          );
        }

        completeText += decoder.decode();

        if (!completeText.trim()) {
          throw new Error(
            "The AI returned an empty response",
          );
        }

        updateMessage(assistantMessageId, completeText);
      } catch (error) {
        if (!isCurrent()) return;
        removeMessage(assistantMessageId);

        push({
          id: nextId(),
          role: "assistant",
          text:
            controller.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
              ? t.chatTimeout
              : t.chatError,
        });
      } finally {
        window.clearTimeout(timeout);
        if (isCurrent()) {
          setPending(false);
          chatRequests.current.delete(requestKey);
        }
      }
    },
    [
      lang,
      setNavMessages,
      t.chatError,
      t.chatTimeout,
      updateDoc,
    ],
  );

  const openPdf = async (data: ArrayBuffer, fileName: string) => {
    // pdf.js may transfer (detach) the buffer, so measure it first.
    const size = data.byteLength;
    const dup = docs.find((d) => d.form.fileName === fileName && d.size === size);
    if (dup) {
      activate(dup.key);
      toast.info(t.alreadyOpen);
      return;
    }
    if (docs.length >= MAX_DOCS) {
      toast.error(t.docLimitTitle, { description: t.docLimitBody });
      return;
    }
    setLoading(true);
    try {
      const loaded = await loadForm(data, fileName);
      const key = `d-${crypto.randomUUID()}`;
      setDocs((ds) => [
        ...ds,
        {
          key,
          form: loaded,
          size,
          page: 1,
          selectedId: null,
          visited: new Set(),
          explanations: {},
          explainErrors: new Set(),
          messages: [],
          pending: false,
          ctxCleared: false,
          tab: "field",
        },
      ]);
      activate(key);
      window.scrollTo({ top: 0 });
      if (loaded.fields.length === 0) toast.warning(t.noFieldsTitle, { description: t.noFieldsBody });
      void sendChat(null, { key, form: loaded }, null, "overview");
    } catch (err) {
      console.error(err);
      toast.error(t.openFailTitle, { description: t.openFailBody });
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(t.tooLargeTitle, { description: t.tooLargeBody });
      return;
    }
    const data = await file.arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(5, data.byteLength)));
    if (header !== "%PDF-") {
      toast.error(t.notPdfTitle, { description: t.notPdfBody });
      return;
    }
    await openPdf(data, file.name);
  };

  const onSample = async () => {
    try {
      const res = await fetch(SAMPLE.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await openPdf(await res.arrayBuffer(), SAMPLE.name);
    } catch {
      toast.error(t.sampleFail);
    }
  };

  const forget = (key: string) => {
    for (const k of requested.current) if (k.startsWith(`${key}:`)) requested.current.delete(k);
  };

  const closeDoc = (key: string) => {
    const idx = docs.findIndex((d) => d.key === key);
    if (idx < 0) return;
    const controller = chatRequests.current.get(key);
    chatRequests.current.delete(key);
    controller?.abort();
    void docs[idx].form.doc.loadingTask.destroy();
    forget(key);
    const rest = docs.filter((d) => d.key !== key);
    const neighbour = rest[Math.min(idx, rest.length - 1)];
    setDocs(rest);
    if (activeKey === key) activate(neighbour?.key ?? null);
    requestAnimationFrame(() => {
      const next = neighbour
        ? document.querySelector<HTMLElement>(`[data-doc-tab="${neighbour.key}"]`)
        : document.getElementById("hero-title");
      next?.focus();
    });
  };

  const reset = () => {
    for (const controller of chatRequests.current.values()) controller.abort();
    chatRequests.current.clear();
    navMessagesRef.current = [];
    setNavMessages([]);
    setNavPending(false);
    for (const d of docs) void d.form.doc.loadingTask.destroy();
    requested.current = new Set();
    setDocs([]);
    activate(null);
    window.scrollTo({ top: 0 });
  };

  const target = active ? { key: active.key, form: active.form } : null;

  const askAboutField = (field: FormField) => {
    if (!active || !target) return;
    updateDoc(active.key, (d) => ({ ...d, ctxCleared: false, tab: "ask" }));
    if (!isDesktop) revealSide();
    void sendChat("What should I enter in this field?", target, field.id);
  };

  const setTab = (tab: Tab) => {
    if (active) updateDoc(active.key, (d) => ({ ...d, tab }));
  };

  const askingAbout = active?.ctxCleared ? undefined : selected;

  const formSuggestions = askingAbout
    ? ["What should I enter in this field?", "Give me an overview of this form"]
    : form?.formNumber === "PPTC 153"
      ? ["Give me an overview of this form", "Who can be my guarantor?", "Where do I put my date of birth?", "How much does a passport cost?"]
      : ["Give me an overview of this form", "Where do I put my address?"];

  const mapHighlight = useMemo(() => {
    const last = [...navMessages].reverse().find((m) => m.role === "assistant");
    return last?.resources?.map((r) => r.id);
  }, [navMessages]);

  const tab = active?.tab ?? "field";

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === "Home" ? "field" : e.key === "End" ? "ask" : tab === "field" ? "ask" : "field";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const header = (
    <header className="flex min-h-[60px] flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-rule bg-desk px-3.5 py-2 sm:gap-x-6 sm:px-7">
      <button
        type="button"
        onClick={reset}
        className="group inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[19px] font-extrabold tracking-[-0.01em] whitespace-nowrap max-sm:mr-auto"
      >
        {active ? (
          <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true" focusable="false">
            <path d="M3 10h28" className="stroke-ink" strokeWidth="2" strokeLinecap="round" />
            <circle cx="17" cy="10" r="6" className="fill-highlighter stroke-ink" strokeWidth="2.5" />
          </svg>
        ) : (
          <svg width="24" height="28" viewBox="0 0 28 32" aria-hidden="true" focusable="false">
            <rect x="3" y="2" width="22" height="28" rx="2" className="fill-paper stroke-ink" strokeWidth="1.6" />
            <rect x="6" y="11.5" width="16" height="6" className="fill-highlighter" />
            <path d="M8 8h12M8 14.5h10M8 21h12M8 25h8" className="stroke-ink" strokeWidth="1.4" />
          </svg>
        )}
        <span className="underline-offset-[0.2em] group-hover:underline">{t.brand}</span>
        <span className="sr-only">{t.brandHome}</span>
      </button>
      <p className="flex items-center gap-2 text-[15px] text-ink-2 max-sm:order-3 max-sm:w-full sm:mr-auto">
        <InfoIcon className="size-5 flex-none text-ink" strokeWidth={2.25} aria-hidden />
        {t.notOfficial}
      </p>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          lang={t.otherLang}
          onClick={() => setLang(t.otherLang)}
          className={cn(btnSecondary, "min-h-11 px-3 sm:px-3.5")}
        >
          {t.otherLangName}
        </button>
        {docs.length > 0 && (
          <button type="button" onClick={reset} className={cn(btnSecondary, "min-h-11 max-sm:min-w-11 max-sm:px-0")}>
            <RotateCcwIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
            <span className="max-sm:sr-only">{t.newSession}</span>
          </button>
        )}
      </div>
    </header>
  );

  if (!active || !form || !target) {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <div className="flex-1">
          <Landing
            loading={loading}
            onFile={onFile}
            onSample={onSample}
            mapHighlight={mapHighlight}
            navigator={
              <ChatPanel
                id="navigator"
                className="h-full"
                messages={navMessages}
                pending={navPending}
                onSend={(text) => void sendChat(text, null, null)}
                suggestions={NAVIGATOR_SUGGESTIONS}
                placeholder={t.navPlaceholder}
                inputLabel={t.navInputLabel}
              />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col desk:h-dvh desk:overflow-hidden">
      {header}
      <main className="flex min-h-0 flex-1 flex-col">
        <h1 className="sr-only">
          {t.brand}: {form.formNumber ?? form.fileName}
        </h1>
        <WorkspacePanels desktop={isDesktop}>
        <Route
          key={active.key}
          fields={form.fields}
          selectedId={active.selectedId}
          visited={active.visited}
          onSelect={(id) => selectField(target, id, "route")}
        />
        <FormViewer
          doc={form.doc}
          page={active.page}
          pageCount={form.pageCount}
          onPageChange={(p) => updateDoc(active.key, (d) => ({ ...d, page: Math.min(Math.max(1, p), form.pageCount) }))}
          fields={form.fields}
          selectedId={active.selectedId}
          visited={active.visited}
          scrollKey={scrollKey}
          loading={loading}
          onSelect={(id) => selectField(target, id, "sheet")}
          onFile={onFile}
          docs={docs.map((d) => ({ key: d.key, fileName: d.form.fileName, formNumber: d.form.formNumber }))}
          activeKey={active.key}
          maxDocs={MAX_DOCS}
          onSwitch={activate}
          onClose={closeDoc}
        />
        <aside
          ref={sideRef}
          aria-label={t.sidePanel}
          className="flex scroll-mt-2 flex-col border-t border-rule bg-paper desk:min-h-0 desk:border-t-0 desk:border-l"
        >
          <div
            role="tablist"
            aria-label={t.sideTabs}
            className="flex flex-none gap-1 border-b border-rule px-3 pt-1 sm:px-5 sm:pt-1.5"
          >
            {(["field", "ask"] as const).map((name) => (
              <button
                key={name}
                ref={(el) => {
                  tabRefs.current[name] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${name}`}
                aria-controls={`panel-${name}`}
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={onTabKey}
                className={cn(
                  "-mb-px inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 border-b-3 px-3 text-base font-bold",
                  tab === name
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-2 hover:bg-desk hover:text-ink",
                )}
              >
                {name === "field" ? (
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-[18px]"
                  >
                    <path d="M12 3v18M12 5h7l2 2.5-2 2.5h-7M12 12H5l-2 2.5L5 17h7" />
                  </svg>
                ) : (
                  <InfoIcon aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
                )}
                {name === "field" ? t.tabField : t.tabAsk}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="panel-field"
            aria-labelledby="tab-field"
            hidden={tab !== "field"}
            className="relative desk:min-h-0 desk:flex-1 desk:overflow-auto"
          >
            <FieldPanel
              fields={form.fields}
              pageCount={form.pageCount}
              selected={selected}
              explanation={selected ? active.explanations[selected.id] : undefined}
              explanationError={selected ? active.explainErrors.has(selected.id) : false}
              onSelect={(id) => selectField(target, id, "step")}
              onAsk={askAboutField}
              onRetry={(f) => void loadExplanation(active.key, f, form.formNumber)}
              onShowOnForm={() => setScrollKey((k) => k + 1)}
            />
          </div>
          <div
            role="tabpanel"
            id="panel-ask"
            aria-labelledby="tab-ask"
            hidden={tab !== "ask"}
            className="flex-col data-[shown]:flex max-desk:h-[min(640px,88dvh)] desk:min-h-0 desk:flex-1"
            data-shown={tab === "ask" ? "" : undefined}
          >
            <ChatPanel
              key={active.key}
              id="ask"
              className="min-h-0 flex-1"
              heading={{ title: t.questionsTitle, sub: t.questionsSub }}
              messages={active.messages}
              pending={active.pending}
              onSend={(text) => void sendChat(text, target, active.ctxCleared ? null : active.selectedId)}
              onFieldRef={(id) => selectField(target, id, "ref")}
              askingAbout={askingAbout}
              onClearAsking={() => updateDoc(active.key, (d) => ({ ...d, ctxCleared: true }))}
              suggestions={formSuggestions}
              placeholder={t.formPlaceholder}
              inputLabel={t.formInputLabel}
            />
          </div>
        </aside>
        </WorkspacePanels>
      </main>
    </div>
  );
}