"use client";

import { FileUpIcon, Loader2Icon, LockIcon, MousePointerClickIcon, PanelRightIcon, SparklesIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

interface LandingProps {
  loading: boolean;
  onFile: (file: File) => void;
  onSample: () => void;
  navigator: ReactNode;
}

const STEPS = [
  { icon: FileUpIcon, title: "Upload a form", text: "Use a fillable PDF from a Government of Canada department." },
  { icon: MousePointerClickIcon, title: "Click any field", text: "Fillable boxes are highlighted right on the page." },
  { icon: PanelRightIcon, title: "Get a plain-language explanation", text: "See what it means, what to enter and where to find it, with official sources." },
];

export function Landing({ loading, onFile, onSample, navigator }: LandingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Understand government forms, one field at a time.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Upload a Government of Canada form and click any field for a plain-language explanation. Or ask the
          service navigator to find the right Canada.ca page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Get help with a form</CardTitle>
              <CardDescription>Fillable PDF, up to 10 MB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) onFile(file);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60",
                  dragging && "border-primary bg-accent",
                )}
              >
                {loading ? (
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" aria-hidden />
                ) : (
                  <FileUpIcon className="size-8 text-muted-foreground" aria-hidden />
                )}
                <span className="font-medium">{loading ? "Reading your form…" : "Drop a PDF here or click to browse"}</span>
                <span className="text-sm text-muted-foreground">Forms from IRCC, CRA, Service Canada and others</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">No form handy?</span>
                <Button variant="outline" onClick={onSample} disabled={loading}>
                  <SparklesIcon />
                  Try the adult passport application (PPTC 153)
                </Button>
              </div>
              <Alert>
                <LockIcon />
                <AlertTitle>Your form stays on your device</AlertTitle>
                <AlertDescription>
                  The PDF is read in your browser and isn&apos;t uploaded or stored. Only field labels are sent to
                  the assistant, never anything you&apos;ve typed into the form.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-card p-3">
                <s.icon className="mb-2 size-5 text-muted-foreground" aria-hidden />
                <div className="text-sm font-medium">
                  {i + 1}. {s.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <Card className="flex h-[560px] flex-col gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Service navigator</CardTitle>
            <CardDescription>Find the right Government of Canada service or page.</CardDescription>
          </CardHeader>
          <div className="min-h-0 flex-1">{navigator}</div>
        </Card>
      </div>
    </div>
  );
}
