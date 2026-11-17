"use client";

import { FileUpIcon, InfoIcon, LockIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { cn } from "cn";
import { useMediaQuery } from "@/hooks/use-media-query";
import { applyAssociation } from "@/lib/context-association";
import { summarizeField } from "@/lib/field-context";
import { loadForm, type LoadedForm } from "@/lib/pdf/extract";
import { readChatEvents } from "@/lib/chat-stream";
import type { LookupChoice, LookupContext } from "@/lib/official/catalog";
import type { ChatMessage, ChatRequest, ChatStreamEvent, FieldExplanation, FormContext, FormField } from "@/lib/types";

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

/** Where a selection came from. Clicks on the sheet itself never scroll the sheet. */
type Origin = "sheet" | "route" | "step" | "ref";
type Tab = "field" | "ask";

function toContext(form: LoadedForm, selectedFieldId?: string): FormContext {
  return {
    formNumber: form.formNumber,
    formTitle: form.formTitle,
    fileName: form.fileName,
    pageCount: form.pageCount,
    fields: form.fields
      .filter((field) => selectedFieldId === undefined || field.id === selectedFieldId)
      .map(summarizeField),
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
  contextPending: ReadonlySet<string>;
  contextErrors: Record<string, "failed" | "uncertain">;
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
  const [chatOnly, setChatOnly] = useState(false);
  const navigatorDocKey = useRef<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const requested = useRef(new Set<string>());
  const sideRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ field: null, ask: null });
  const navMessagesRef = useRef<ChatMessage[]>([]);
  const docsRef = useRef<DocSession[]>([]);
  const chatRequests = useRef(new Map<string, AbortController>());
  const lookupScopes = useRef(new Map<string, LookupContext>());
  const contextRequests = useRef(new Map<string, AbortController>());
  const previousLang = useRef(lang);

  useEffect(() => {
    const requests = chatRequests.current;
    const associations = contextRequests.current;
    return () => {
      for (const controller of requests.values()) controller.abort();
      requests.clear();
      for (const controller of associations.values()) controller.abort();
      associations.clear();
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
            field: summarizeField(field),
            formNumber,
            language: lang,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FieldExplanation;
        updateDoc(key, (d) => d.form.fields.find((f) => f.id === field.id) !== field
          ? d : ({ ...d, explanations: { ...d.explanations, [field.id]: data } }));
      } catch {
        requested.current.delete(`${key}:${field.id}`);
        updateDoc(key, (d) => d.form.fields.find((f) => f.id === field.id) !== field
          ? d : ({ ...d, explainErrors: new Set(d.explainErrors).add(field.id) }));
      }
    },
    [updateDoc, lang],
  );

  useEffect(() => {
    if (previousLang.current === lang) return;
    previousLang.current = lang;
    requested.current = new Set();
    setDocs((current) => current.map((doc) => ({
      ...doc,
      explanations: {},
    })));

    const doc = docsRef.current.find((item) => item.key === activeRef.current);
    const field = doc?.form.fields.find((item) => item.id === doc.selectedId);
    if (doc && field) void loadExplanation(doc.key, field, doc.form.formNumber);
  }, [lang, loadExplanation]);

  const identifyContext = useCallback(async (key: string, fieldId: string) => {
    const doc = docsRef.current.find((doc) => doc.key === key);
    const field = doc?.form.fields.find((field) => field.id === fieldId);
    if (!doc || !field?.contextCandidates?.blocks.length) return;
    const requestKey = `${key}:${fieldId}`;
    if (contextRequests.current.has(requestKey)) return;
    const controller = new AbortController();
    contextRequests.current.set(requestKey, controller);
    const isCurrent = () => contextRequests.current.get(requestKey) === controller;
    updateDoc(key, (d) => {
      const errors = { ...d.contextErrors };
      delete errors[fieldId];
      return { ...d, contextPending: new Set(d.contextPending).add(fieldId), contextErrors: errors };
    });
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/field-context", {
        method: "POST", headers: { "Content-Type": "application/json" },
        cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ fieldId, page: field.page, type: field.type, candidates: field.contextCandidates }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { selection } = await response.json() as { selection: unknown };
      const updatedField = applyAssociation(field, selection);
      if (!isCurrent()) return;
      if (updatedField === field) {
        updateDoc(key, (d) => ({ ...d, contextErrors: { ...d.contextErrors, [fieldId]: "uncertain" } }));
        return;
      }
      updateDoc(key, (d) => {
        const explanations = { ...d.explanations };
        delete explanations[fieldId];
        return {
          ...d,
          form: { ...d.form, fields: d.form.fields.map((f) => f.id === fieldId ? updatedField : f) },
          explanations,
        };
      });
      void loadExplanation(key, updatedField, doc.form.formNumber);
    } catch {
      if (isCurrent()) updateDoc(key, (d) => ({ ...d, contextErrors: { ...d.contextErrors, [fieldId]: "failed" } }));
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent()) {
        contextRequests.current.delete(requestKey);
        updateDoc(key, (d) => {
          const pending = new Set(d.contextPending);
          pending.delete(fieldId);
          return { ...d, contextPending: pending };
        });
      }
    }
  }, [loadExplanation, updateDoc]);

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
        tab: "field",
      }));
      if (!requested.current.has(`${target.key}:${id}`)) void loadExplanation(target.key, field, target.form.formNumber);
      if (target.key !== activeRef.current) return;
      if (isDesktop) {
        if (origin !== "sheet") setScrollKey((k) => k + 1);
      } else if (origin === "sheet" || origin === "route") {
        revealSide();
      } else if (origin === "ref") {
        setScrollKey((k) => k + 1);
      }
    },
    [isDesktop, loadExplanation, revealSide, updateDoc],
  );

  /** A null target uses the general chat, including requests migrated into a PDF. */
  const sendChat = useCallback(
    async (
      text: string | null,
      target: Target | null,
      fieldId: string | null,
      intent?: ChatRequest["intent"],
      options?: { lookupContext?: LookupContext; lookupChoice?: LookupChoice; displayText?: string; retry?: boolean },
    ) => {
      const requestKey = target?.key ?? "navigator";
      if (chatRequests.current.has(requestKey)) return;
      const controller = new AbortController();
      chatRequests.current.set(requestKey, controller);
      const isCurrent = () => chatRequests.current.get(requestKey) === controller;
      const currentMessages = target
        ? docsRef.current.find((doc) => doc.key === target.key)?.messages ?? []
        : navMessagesRef.current;
      const lookupContext = options?.lookupContext ?? lookupScopes.current.get(requestKey) ?? {};

      const push = (message: ChatMessage) => {
        if (!isCurrent()) return;
        const msg = { ...message, language: lang };
        const key = target?.key ?? navigatorDocKey.current;
        return key
          ? updateDoc(key, (doc) => ({
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
        patch: Partial<ChatMessage>,
      ) => {
        if (!isCurrent()) return;
        const key = target?.key ?? navigatorDocKey.current;
        return key
          ? updateDoc(key, (doc) => ({
              ...doc,
              messages: doc.messages.map((message) =>
                message.id === messageId
                  ? { ...message, ...patch }
                  : message,
              ),
            }))
          : setNavMessages((messages) =>
              messages.map((message) =>
                message.id === messageId
                  ? { ...message, ...patch }
                  : message,
              ),
            );
      };

      const setPending = (pending: boolean) => {
        const key = target?.key ?? navigatorDocKey.current;
        return key
          ? updateDoc(key, (doc) => ({
              ...doc,
              pending,
            }))
          : setNavPending(pending);
      };

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

      if (text && !options?.retry) {
        push({
          id: nextId(),
          role: "user",
          text: options?.displayText ?? text,
        });
      }

      const assistantMessageId = nextId();

      push({
        id: assistantMessageId,
        role: "assistant",
        text: "",
        request: {
          message: text ?? undefined,
          intent,
          selectedFieldId: fieldId ?? undefined,
          lookupContext,
          lookupChoice: options?.lookupChoice,
        },
      });

      setPending(true);

      const timeout = window.setTimeout(
        () => controller.abort(),
        60_000,
      );

      let responseError: ChatMessage["error"] = "connection";
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
              ? toContext(
                  docsRef.current.find((doc) => doc.key === target.key)?.form ?? target.form,
                  intent === "field" ? fieldId ?? undefined : undefined,
                )
              : undefined,
            selectedFieldId: fieldId ?? undefined,
            history,
            language: lang,
            lookupContext,
            lookupChoice: options?.lookupChoice,
          }),
        });
        if (!res.ok) {
          responseError = res.status === 503 ? "not_configured" : res.status === 504 ? "timeout" : "unavailable";
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

        if (!res.headers.get("content-type")?.startsWith("text/event-stream")) {
          throw new Error("The server returned an unsupported response stream");
        }

        let completeText = "";
        let completed = false;
        let lookupReceived = false;

        const applyEvent = (event: ChatStreamEvent) => {
          if (event.type === "delta") {
            completeText += event.text;
            updateMessage(assistantMessageId, { text: completeText });
          } else if (event.type === "lookup") {
            lookupReceived = true;
            if (isCurrent()) {
              const { serviceId, jurisdiction, facetId, formId, publicForm, passportMode } = event.outcome;
              const scope = {
                ...(serviceId !== undefined && { serviceId }),
                ...(jurisdiction !== undefined && { jurisdiction }),
                ...(facetId !== undefined && { facetId }),
                ...(formId !== undefined && { formId }),
                ...(publicForm !== undefined && { publicForm }),
                ...(passportMode !== undefined && { passportMode }),
              };
              if (Object.keys(scope).length) {
                lookupScopes.current.set(target?.key ?? navigatorDocKey.current ?? "navigator", scope);
              }
            }
            updateMessage(assistantMessageId, {
              lookup: event.outcome,
              resources: event.sources,
            });
          } else if (event.type === "error") {
            updateMessage(assistantMessageId, {
              incomplete: true,
              error: event.code === "unavailable" ? "timeout" : "unavailable",
            });
          } else if (event.type === "complete") {
            completed = true;
            updateMessage(assistantMessageId, { incomplete: !event.complete });
          }
        };

        for await (const event of readChatEvents(res.body)) applyEvent(event);
        if (!completed) throw new Error("The assistant stream did not complete");

        if (!completeText.trim() && !lookupReceived) {
          throw new Error(
            "The AI returned an empty response",
          );
        }

        updateMessage(assistantMessageId, { text: completeText });
      } catch (error) {
        if (!isCurrent()) return;
        updateMessage(assistantMessageId, {
          incomplete: true,
          error:
            controller.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
              ? "timeout"
              : responseError,
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
      const fromChat = chatOnly && docs.length === 0;
      const migratingRequest = fromChat && chatRequests.current.has("navigator");
      const session: DocSession = {
        key,
        form: loaded,
        size,
        page: 1,
        selectedId: null,
        visited: new Set(),
        explanations: {},
        explainErrors: new Set(),
        contextPending: new Set(),
        contextErrors: {},
        messages: fromChat ? navMessagesRef.current : [],
        pending: migratingRequest,
        ctxCleared: false,
        tab: fromChat ? "ask" : "field",
      };
      if (fromChat) {
        const scope = lookupScopes.current.get("navigator");
        if (scope) lookupScopes.current.set(key, scope);
        lookupScopes.current.delete("navigator");
        navigatorDocKey.current = key;
        setNavPending(false);
      }
      docsRef.current = [...docsRef.current, session];
      setDocs((ds) => [...ds, session]);
      activate(key);
      window.scrollTo({ top: 0 });
      if (loaded.fields.length === 0) toast.warning(t.noFieldsTitle, { description: t.noFieldsBody });
      if (!migratingRequest) void sendChat(null, { key, form: loaded }, null, "overview");
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
    if (navigatorDocKey.current === key) {
      const navigatorRequest = chatRequests.current.get("navigator");
      chatRequests.current.delete("navigator");
      navigatorRequest?.abort();
      navigatorDocKey.current = null;
    }
    for (const [requestKey, request] of contextRequests.current) {
      if (requestKey.startsWith(`${key}:`)) {
        contextRequests.current.delete(requestKey);
        request.abort();
      }
    }
    void docs[idx].form.doc.loadingTask.destroy();
    forget(key);
    const rest = docs.filter((d) => d.key !== key);
    const neighbour = rest[Math.min(idx, rest.length - 1)];
    if (rest.length === 0 && chatOnly) {
      const scope = lookupScopes.current.get(key);
      if (scope) lookupScopes.current.set("navigator", scope);
      else lookupScopes.current.delete("navigator");
      const messages = docs[idx].pending
        ? docs[idx].messages.filter((message, index, all) => index !== all.length - 1 || message.role !== "assistant")
        : docs[idx].messages;
      navMessagesRef.current = messages;
      setNavMessages(messages);
      setNavPending(false);
    }
    lookupScopes.current.delete(key);
    setDocs(rest);
    if (activeKey === key) activate(neighbour?.key ?? null);
    requestAnimationFrame(() => {
      const next = neighbour
        ? document.querySelector<HTMLElement>(`[data-doc-tab="${neighbour.key}"]`)
        : document.getElementById(chatOnly ? "chat-only-title" : "hero-title");
      next?.focus();
    });
  };

  const reset = () => {
    for (const controller of chatRequests.current.values()) controller.abort();
    chatRequests.current.clear();
    lookupScopes.current.clear();
    for (const controller of contextRequests.current.values()) controller.abort();
    contextRequests.current.clear();
    navMessagesRef.current = [];
    setNavMessages([]);
    setNavPending(false);
    navigatorDocKey.current = null;
    setChatOnly(false);
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
    void sendChat(t.fieldSuggestion, target, field.id, "field");
  };

  const setTab = (tab: Tab) => {
    if (active) updateDoc(active.key, (d) => ({ ...d, tab }));
  };

  const askingAbout = active?.ctxCleared ? undefined : selected;

  const formSuggestions = askingAbout
    ? [t.fieldSuggestion, t.downloadSuggestion, t.overviewSuggestion]
    : [t.overviewSuggestion, t.downloadSuggestion, t.feesSuggestion];

  const retryChat = (message: ChatMessage, destination: Target | null) => {
    if (!message.request) return;
    void sendChat(message.request.message ?? null, destination, message.request.selectedFieldId ?? null, message.request.intent, {
      lookupContext: message.request.lookupContext,
      lookupChoice: message.request.lookupChoice,
      retry: true,
    });
  };

  const resolveChat = (message: ChatMessage, destination: Target | null, choice: LookupChoice, label: string) => {
    if (!message.request) return;
    const question = message.request.message ?? label;
    void sendChat(question, destination, message.request.selectedFieldId ?? null, undefined, {
      lookupContext: { ...message.request.lookupContext, ...choice },
      lookupChoice: { ...message.request.lookupChoice, ...choice },
      displayText: label,
    });
  };

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
        aria-label={`${t.brand}${t.brandHome}`}
        className="group inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm text-[25px] leading-none font-extrabold tracking-[-0.025em] whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink max-sm:mr-auto"
      >
        <svg width="24" height="28" viewBox="0 0 28 32" aria-hidden="true" focusable="false">
          <rect x="3" y="2" width="22" height="28" rx="2" className="fill-paper stroke-ink" strokeWidth="1.6" />
          <rect x="6" y="11.5" width="16" height="6" className="fill-highlighter" />
          <path d="M8 8h12M8 14.5h10M8 21h12M8 25h8" className="stroke-ink" strokeWidth="1.4" />
        </svg>
        <span aria-hidden="true">form<span className="relative isolate ml-px inline-block px-0.5 before:absolute before:inset-x-0 before:bottom-0 before:-z-10 before:h-[0.46em] before:-rotate-3 before:bg-highlighter group-hover:before:bg-highlighter-deep">ER</span></span>
      </button>
      <p className="flex min-w-0 items-start gap-2 text-[13px] leading-[1.4] text-ink-2 max-sm:order-3 max-sm:w-full sm:mr-auto sm:flex-1">
        <LockIcon className="mt-0.5 size-3.5 flex-none text-ink" strokeWidth={2.25} aria-hidden />
        <span>{t.labelsOnly}</span>
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
        {(docs.length > 0 || chatOnly) && (
          <button type="button" onClick={reset} className={cn(btnSecondary, "min-h-11 max-sm:min-w-11 max-sm:px-0")}>
            <RotateCcwIcon className="size-[18px]" strokeWidth={2.25} aria-hidden />
            <span className="max-sm:sr-only">{t.newSession}</span>
          </button>
        )}
      </div>
    </header>
  );

  if (!active || !form || !target) {
    if (chatOnly) {
      return (
        <div className="flex min-h-dvh flex-col desk:h-dvh desk:overflow-hidden">
          {header}
          <main className="pr-view-enter flex min-h-0 flex-1 flex-col bg-desk px-3 py-4 sm:px-7 sm:py-6">
            <section aria-labelledby="chat-only-title" className="mx-auto flex min-h-0 w-full max-w-[860px] flex-1 flex-col rounded-md border border-rule bg-paper shadow-card">
              <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-rule-2 px-4 py-4 sm:px-5">
                <div>
                  <h1 id="chat-only-title" tabIndex={-1} className="text-[27px] leading-tight font-extrabold">{t.chatTitle}</h1>
                  <p className="mt-1 text-[17px] text-ink-2">{t.chatSub}</p>
                </div>
                <label className={cn(btnSecondary, "focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ink", loading && "cursor-progress opacity-45")}>
                  <FileUpIcon className="size-5" aria-hidden />
                  {loading ? t.opening : t.addPdf}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    aria-label={t.addPdf}
                    disabled={loading}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="sr-only" role="status">{loading ? t.reading : ""}</p>
              <ChatPanel
                id="chat-only"
                className="min-h-0 flex-1"
                logClassName="min-h-48 max-h-[60dvh] desk:min-h-0 desk:max-h-none"
                messages={navMessages}
                pending={navPending}
                onSend={(text) => void sendChat(text, null, null)}
                onRetry={(message) => retryChat(message, null)}
                onResolve={(message, choice, label) => resolveChat(message, null, choice, label)}
                suggestions={t.navigatorSuggestions}
                placeholder={t.navPlaceholder}
                inputLabel={t.navInputLabel}
              />
            </section>
          </main>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <div className="flex-1">
          <Landing
            loading={loading}
            onFile={onFile}
            onSample={onSample}
            onStartChat={() => {
              setChatOnly(true);
              window.scrollTo({ top: 0 });
              requestAnimationFrame(() => document.getElementById("chat-only-title")?.focus());
            }}
            mapHighlight={mapHighlight}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col desk:h-dvh desk:overflow-hidden">
      {header}
      <main className="pr-view-enter pr-workspace flex min-h-0 flex-1 flex-col">
        <p className="sr-only" role="status" aria-live="polite">
          {selected ? t.fieldSelected(selected.label, selected.page) : ""}
        </p>
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
            className="pr-tab-panel relative desk:min-h-0 desk:flex-1 desk:overflow-auto"
          >
            <FieldPanel
              fields={form.fields}
              pageCount={form.pageCount}
              selected={selected}
              explanation={selected ? active.explanations[selected.id] : undefined}
              explanationError={selected ? active.explainErrors.has(selected.id) : false}
              contextPending={selected ? active.contextPending?.has(selected.id) : false}
              contextError={selected ? active.contextErrors?.[selected.id] : undefined}
              onIdentify={(field) => void identifyContext(active.key, field.id)}
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
            className="pr-tab-panel flex-col data-[shown]:flex max-desk:h-[min(640px,88dvh)] desk:min-h-0 desk:flex-1"
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
              onRetry={(message) => retryChat(message, target)}
              onResolve={(message, choice, label) => resolveChat(message, target, choice, label)}
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
