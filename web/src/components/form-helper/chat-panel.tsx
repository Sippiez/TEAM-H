"use client";

import { BotIcon, CornerDownLeftIcon, LocateFixedIcon, SparklesIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import type { ChatMessage, FormField } from "@/lib/types";

import { OverviewCard } from "./overview-card";
import { ResourceList } from "./resource-list";
import { RichText } from "./rich-text";

interface ChatPanelProps {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  onFieldRef?: (fieldId: string) => void;
  selectedField?: FormField;
  onClearSelection?: () => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export function ChatPanel({
  messages,
  pending,
  onSend,
  onFieldRef,
  selectedField,
  onClearSelection,
  suggestions,
  placeholder = "Ask about this form or a government service…",
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value);
    setDraft("");
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <SparklesIcon className="size-5" aria-hidden />
            <p>Ask a question, or pick a suggestion below.</p>
          </div>
        )}
        <ol className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && (
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <BotIcon className="size-3.5" aria-hidden />
                </div>
              )}
              <div
                className={cn(
                  "min-w-0 space-y-2 text-sm",
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
                    : "flex-1",
                )}
              >
                <span className="sr-only">{m.role === "user" ? "You said:" : "Assistant said:"}</span>
                {m.role === "user" ? <p className="whitespace-pre-wrap">{m.text}</p> : <RichText text={m.text} />}
                {m.overview && <OverviewCard overview={m.overview} />}
                {m.fieldRefs && m.fieldRefs.length > 0 && onFieldRef && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.fieldRefs.map((f) => (
                      <Button key={f.id} variant="outline" size="xs" onClick={() => onFieldRef(f.id)}>
                        <LocateFixedIcon aria-hidden />
                        {f.label}
                      </Button>
                    ))}
                  </div>
                )}
                {m.resources && m.resources.length > 0 && <ResourceList resources={m.resources} />}
              </div>
            </li>
          ))}
          {pending && (
            <li className="flex gap-2" aria-label="Assistant is typing">
              <div className="mt-0.5 size-6 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          )}
        </ol>
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t p-3">
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Button key={s} variant="secondary" size="xs" disabled={pending} onClick={() => submit(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        {selectedField && (
          <Badge variant="outline" className="max-w-full gap-1">
            <span className="truncate">Asking about: {selectedField.label}</span>
            {onClearSelection && (
              <button
                type="button"
                className="rounded-sm opacity-70 hover:opacity-100"
                aria-label="Stop asking about this field"
                onClick={onClearSelection}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </Badge>
        )}
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <Textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder={placeholder}
            maxLength={1000}
            rows={2}
            className="max-h-40 min-h-16 resize-none pr-11"
          />
          <Button
            type="submit"
            size="icon-sm"
            className="absolute right-2 bottom-2"
            disabled={pending || !draft.trim()}
            aria-label="Send message"
          >
            <CornerDownLeftIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}
