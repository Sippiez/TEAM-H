"use client";

import { FileSearchIcon, FileTextIcon, MessageSquareIcon, PanelRightIcon, RotateCcwIcon, ScrollTextIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { loadForm, type LoadedForm } from "@/lib/pdf/extract";
import type { AssistantReply, ChatMessage, FieldExplanation, FormContext, FormField } from "@/lib/types";

import { ChatPanel } from "./chat-panel";
import { FieldPanel } from "./field-panel";
import { FormViewer } from "./form-viewer";
import { Landing } from "./landing";

const MAX_BYTES = 10 * 1024 * 1024;
const SAMPLE = { url: "/forms/pptc153.pdf", name: "pptc153.pdf" };

const NAVIGATOR_SUGGESTIONS = [
  "How do I renew my passport?",
  "I lost my job. What can I apply for?",
  "Sign in to my CRA account",
];

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

let messageCounter = 0;
const nextId = () => `m-${++messageCounter}`;

export function FormHelperApp() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [form, setForm] = useState<LoadedForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set());
  const [explanations, setExplanations] = useState<Record<string, FieldExplanation>>({});
  const [explainErrors, setExplainErrors] = useState<ReadonlySet<string>>(() => new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [chatSheet, setChatSheet] = useState(false);
  const [fieldSheet, setFieldSheet] = useState(false);
  const requested = useRef(new Set<string>());

  const selected = useMemo(() => form?.fields.find((f) => f.id === selectedId), [form, selectedId]);

  const loadExplanation = useCallback(async (field: FormField, formNumber?: string) => {
    requested.current.add(field.id);
    setExplainErrors((s) => {
      if (!s.has(field.id)) return s;
      const next = new Set(s);
      next.delete(field.id);
      return next;
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
      setExplanations((e) => ({ ...e, [field.id]: data }));
    } catch {
      requested.current.delete(field.id);
      setExplainErrors((s) => new Set(s).add(field.id));
    }
  }, []);

  const selectField = useCallback(
    (id: string, source: LoadedForm | null, openPanel = true) => {
      const field = source?.fields.find((f) => f.id === id);
      if (!field || !source) return;
      setSelectedId(id);
      setPage(field.page);
      setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
      if (!requested.current.has(id)) void loadExplanation(field, source.formNumber);
      if (!isDesktop && openPanel) {
        setChatSheet(false);
        setFieldSheet(true);
      }
    },
    [isDesktop, loadExplanation],
  );

  const sendChat = useCallback(
    async (text: string | null, opts: { intent?: "overview"; source?: LoadedForm | null; fieldId?: string | null } = {}) => {
      const source = opts.source !== undefined ? opts.source : form;
      const fieldId = opts.fieldId !== undefined ? opts.fieldId : selectedId;
      if (text) setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
      setPending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text ?? undefined,
            intent: opts.intent,
            form: source ? toContext(source) : undefined,
            selectedFieldId: fieldId ?? undefined,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reply = (await res.json()) as AssistantReply;
        setMessages((m) => [...m, { id: nextId(), role: "assistant", ...reply }]);
        if (reply.highlightFieldId && source && reply.highlightFieldId !== fieldId) {
          selectField(reply.highlightFieldId, source, false);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", text: "Sorry, I couldn't reach the assistant. Please try again." },
        ]);
      } finally {
        setPending(false);
      }
    },
    [form, selectedId, selectField],
  );

  const openPdf = async (data: ArrayBuffer, fileName: string) => {
    setLoading(true);
    try {
      const loaded = await loadForm(data, fileName);
      void form?.doc.loadingTask.destroy();
      requested.current = new Set();
      setForm(loaded);
      setPage(1);
      setSelectedId(null);
      setVisited(new Set());
      setExplanations({});
      setExplainErrors(new Set());
      if (loaded.fields.length === 0) {
        toast.warning("No fillable fields found", {
          description: "This MVP works with fillable PDFs. Scanned or flattened forms aren't supported yet.",
        });
      } else {
        toast.success(`Found ${loaded.fields.length} fields`, {
          description: loaded.formNumber ? `Detected form ${loaded.formNumber}` : "Click any highlighted box.",
        });
      }
      void sendChat(null, { intent: "overview", source: loaded, fieldId: null });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open this PDF", {
        description: "It may be damaged, password-protected or an XFA-only form.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: "Please choose a PDF under 10 MB." });
      return;
    }
    const data = await file.arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(5, data.byteLength)));
    if (header !== "%PDF-") {
      toast.error("That isn't a PDF", { description: "Please choose a PDF form." });
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
      toast.error("Couldn't load the sample form");
    }
  };

  const reset = () => {
    void form?.doc.loadingTask.destroy();
    setForm(null);
    setSelectedId(null);
  };

  const askAboutField = (field: FormField) => {
    if (!isDesktop) {
      setFieldSheet(false);
      setChatSheet(true);
    }
    void sendChat("What should I enter in this field?", { fieldId: field.id });
  };

  const formSuggestions = selected
    ? ["What should I enter in this field?", "Give me an overview of this form"]
    : form?.formNumber === "PPTC 153"
      ? ["Give me an overview of this form", "Who can be my guarantor?", "Where do I put my date of birth?", "How much does a passport cost?"]
      : ["Give me an overview of this form", "Where do I put my address?"];

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <button type="button" onClick={reset} className="flex items-center gap-2 rounded-md font-heading font-semibold" aria-label="Form Helper home">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FileSearchIcon className="size-4" aria-hidden />
        </span>
        <span className="hidden sm:inline">Form Helper</span>
      </button>
      <Badge variant="outline" className="hidden md:inline-flex">
        Unofficial demo
      </Badge>
      {form && (
        <div className="ml-2 flex min-w-0 items-center gap-2">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm">{form.fileName}</span>
          {form.formNumber && <Badge variant="secondary">{form.formNumber}</Badge>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Badge variant="outline" className="hidden text-muted-foreground lg:inline-flex" title="Answers come from curated rules, not an AI model">
          Rule-based demo · no AI model connected
        </Badge>
        {form && (
          <>
            <Button variant="ghost" size="sm" onClick={() => sendChat(null, { intent: "overview" })} disabled={pending}>
              <ScrollTextIcon />
              <span className="hidden sm:inline">Overview</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcwIcon />
              <span className="hidden sm:inline">New form</span>
            </Button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );

  const chat = (
    <ChatPanel
      messages={messages}
      pending={pending}
      onSend={(t) => void sendChat(t)}
      onFieldRef={form ? (id) => selectField(id, form) : undefined}
      selectedField={selected}
      onClearSelection={() => setSelectedId(null)}
      suggestions={form ? formSuggestions : NAVIGATOR_SUGGESTIONS}
      placeholder={form ? "Ask about this form or a field…" : "Ask about a government service…"}
    />
  );

  if (!form) {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="flex-1">
          <Landing loading={loading} onFile={onFile} onSample={onSample} navigator={chat} />
        </main>
        <Disclaimer />
      </div>
    );
  }

  const fieldPanel = (
    <FieldPanel
      fields={form.fields}
      selected={selected}
      explanation={selected ? explanations[selected.id] : undefined}
      explanationError={selected ? explainErrors.has(selected.id) : false}
      visited={visited}
      onSelect={(id) => selectField(id, form, false)}
      onBack={() => setSelectedId(null)}
      onAsk={askAboutField}
      onRetry={(f) => void loadExplanation(f, form.formNumber)}
    />
  );

  const viewer = (
    <FormViewer
      doc={form.doc}
      page={page}
      pageCount={form.pageCount}
      onPageChange={(p) => setPage(Math.min(Math.max(1, p), form.pageCount))}
      fields={form.fields}
      selectedId={selectedId}
      visited={visited}
      onSelect={(id) => selectField(id, form)}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      {header}
      {isDesktop ? (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="27%" minSize="18%" maxSize="40%">
            <section aria-label="Chat" className="flex h-full flex-col">
              <h2 className="sr-only">Chat</h2>
              {chat}
            </section>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="45%" minSize="30%">
            <section aria-label="Form" className="h-full">
              {viewer}
            </section>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="28%" minSize="20%" maxSize="45%">
            <aside aria-label="Field details" className="h-full">
              {fieldPanel}
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          <main className="min-h-0 flex-1">{viewer}</main>
          <nav className="grid shrink-0 grid-cols-2 gap-2 border-t p-2" aria-label="Panels">
            <Button variant="outline" onClick={() => setChatSheet(true)}>
              <MessageSquareIcon />
              Chat
            </Button>
            <Button variant="outline" onClick={() => setFieldSheet(true)}>
              <PanelRightIcon />
              {selected ? "Field details" : "All fields"}
            </Button>
          </nav>
          <Sheet open={chatSheet} onOpenChange={setChatSheet}>
            <SheetContent side="bottom" className="h-[85dvh] gap-0 p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Chat</SheetTitle>
                <SheetDescription>Ask about this form or a government service.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1">{chat}</div>
            </SheetContent>
          </Sheet>
          <Sheet open={fieldSheet} onOpenChange={setFieldSheet}>
            <SheetContent side="bottom" className="h-[85dvh] gap-0 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Field details</SheetTitle>
                <SheetDescription>Explanation of the selected form field.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 pt-8">{fieldPanel}</div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function Disclaimer() {
  return (
    <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
      Unofficial hackathon prototype, not affiliated with the Government of Canada. Explanations are general
      information, not legal advice. Always check the official instructions on Canada.ca.
    </footer>
  );
}
