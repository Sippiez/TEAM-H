"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  ListChecksIcon,
  MapPinIcon,
  MessageSquareIcon,
  PencilLineIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "cn";
import type { FieldExplanation, FormField } from "@/lib/types";

import { ResourceList } from "./resource-list";

const TYPE_LABEL: Record<FormField["type"], string> = {
  text: "Text",
  checkbox: "Checkbox",
  radio: "Choose one",
  choice: "Drop-down",
  signature: "Signature",
};

interface FieldPanelProps {
  fields: FormField[];
  selected?: FormField;
  explanation?: FieldExplanation;
  explanationError?: boolean;
  visited: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
  onBack: () => void;
  onAsk: (field: FormField) => void;
  onRetry: (field: FormField) => void;
}

export function FieldPanel(props: FieldPanelProps) {
  return props.selected ? (
    <FieldDetails {...props} selected={props.selected} />
  ) : (
    <FieldBrowser fields={props.fields} visited={props.visited} onSelect={props.onSelect} />
  );
}

function FieldBrowser({
  fields,
  visited,
  onSelect,
}: Pick<FieldPanelProps, "fields" | "visited" | "onSelect">) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "todo" | "viewed">("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = fields.filter((f) => {
      if (tab === "viewed" && !visited.has(f.id)) return false;
      if (tab === "todo" && visited.has(f.id)) return false;
      return !q || f.label.toLowerCase().includes(q) || f.section.toLowerCase().includes(q);
    });
    const map = new Map<string, FormField[]>();
    for (const f of filtered) map.set(f.section, [...(map.get(f.section) ?? []), f]);
    return [...map.entries()];
  }, [fields, visited, query, tab]);

  const progress = fields.length ? Math.round((visited.size / fields.length) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-3">
        <div>
          <h2 className="font-heading text-base font-medium">Form fields</h2>
          <p className="text-sm text-muted-foreground">
            Click a highlighted box on the form, or pick a field below.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Reviewed</span>
            <span className="tabular-nums">
              {visited.size}/{fields.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Fields reviewed">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields…"
            aria-label="Search fields"
            className="pl-8"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="todo">Not viewed</TabsTrigger>
            <TabsTrigger value="viewed">Viewed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">No fields match.</p>
        )}
        {groups.map(([section, items]) => (
          <section key={section} className="mb-3">
            <h3 className="sticky top-0 z-10 bg-background/95 px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
              {section}
            </h3>
            <ul>
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(f.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        visited.has(f.id) && "border-emerald-500 bg-emerald-500 text-white",
                      )}
                      aria-hidden
                    >
                      {visited.has(f.id) && <CheckIcon className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">p.{f.page}</span>
                    {visited.has(f.id) && <span className="sr-only">(viewed)</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FieldDetails({
  fields,
  selected,
  explanation,
  explanationError,
  onSelect,
  onBack,
  onAsk,
  onRetry,
}: FieldPanelProps & { selected: FormField }) {
  const index = fields.findIndex((f) => f.id === selected.id);
  const prev = fields[index - 1];
  const next = fields[index + 1];
  const related = fields.filter((f) => f.section === selected.section && f.id !== selected.id).slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <Button variant="ghost" size="xs" onClick={onBack} className="-ml-1.5">
          <ArrowLeftIcon />
          All fields
        </Button>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{selected.section}</Badge>
          <Badge variant="outline">Page {selected.page}</Badge>
          <Badge variant="outline">{TYPE_LABEL[selected.type]}</Badge>
        </div>
        <h2 className="font-heading text-lg leading-snug font-semibold">{selected.label}</h2>
        {selected.tooltip && selected.tooltip !== selected.label && (
          <p className="text-xs text-muted-foreground">
            Label in the PDF: <q>{selected.tooltip}</q>
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {explanationError ? (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertDescription>
              Couldn&apos;t load an explanation.{" "}
              <button type="button" className="underline" onClick={() => onRetry(selected)}>
                Try again
              </button>
            </AlertDescription>
          </Alert>
        ) : !explanation ? (
          <div className="space-y-3" aria-label="Loading explanation">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ExplanationBody key={selected.id} field={selected} e={explanation} />
        )}

        {related.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Other fields in this section</div>
            <div className="flex flex-wrap gap-1.5">
              {related.map((f) => (
                <Button key={f.id} variant="outline" size="xs" onClick={() => onSelect(f.id)} className="max-w-full">
                  <span className="truncate">{f.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t p-2">
        <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && onSelect(prev.id)} aria-label="Previous field">
          <ChevronLeftIcon />
          Prev
        </Button>
        <Button className="flex-1" size="sm" onClick={() => onAsk(selected)}>
          <MessageSquareIcon />
          Ask about this field
        </Button>
        <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next field">
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

function ExplanationBody({ field, e }: { field: FormField; e: FieldExplanation }) {
  const items = ["meaning", "enter", "find", "points", "mistakes", "sources"];
  return (
    <div className="space-y-3">
      {e.grounded ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <BadgeCheckIcon className="size-3.5" aria-hidden />
          Based on official Canada.ca guidance
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InfoIcon className="size-3.5" aria-hidden />
          General guidance. Check the form&apos;s instructions.
        </div>
      )}
      <Accordion multiple defaultValue={items}>
        <AccordionItem value="meaning">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <InfoIcon className="size-4 text-sky-600" aria-hidden />
              What it means
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p>{e.meaning}</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="enter">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <PencilLineIcon className="size-4 text-violet-600" aria-hidden />
              What to enter
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <p>{e.whatToEnter}</p>
            {e.formatExample && (
              <div className="rounded-md border bg-muted/50 px-2.5 py-1.5">
                <div className="text-xs text-muted-foreground">Example</div>
                <code className="font-mono text-sm">{e.formatExample}</code>
              </div>
            )}
            {field.options && field.options.length > 0 && field.options.length <= 12 && (
              <div>
                <div className="text-xs text-muted-foreground">Options</div>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {field.options.map((o) => (
                    <li key={o}>
                      <Badge variant="outline">{o}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
        {e.whereToFind && (
          <AccordionItem value="find">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-orange-600" aria-hidden />
                Where to find it
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p>{e.whereToFind}</p>
            </AccordionContent>
          </AccordionItem>
        )}
        {e.keyPoints && (
          <AccordionItem value="points">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <ListChecksIcon className="size-4 text-emerald-600" aria-hidden />
                {e.keyPoints.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {e.keyPoints.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
        {e.commonMistakes.length > 0 && (
          <AccordionItem value="mistakes">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <AlertTriangleIcon className="size-4 text-amber-600" aria-hidden />
                Common mistakes
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="ml-4 list-disc space-y-1 marker:text-muted-foreground">
                {e.commonMistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
        {e.sources.length > 0 && (
          <AccordionItem value="sources">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <BadgeCheckIcon className="size-4 text-sky-600" aria-hidden />
                Official sources
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ResourceList resources={e.sources} compact />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
