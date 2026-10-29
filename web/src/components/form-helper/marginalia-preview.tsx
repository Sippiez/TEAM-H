"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { getResources } from "@/lib/catalog/resources";

import { useI18n } from "./i18n";

const sources = getResources(["passport-citizenship-proof", "passport-submit"]);
const noteFields = ["surname", "dob", "travel"] as const;

interface Leader {
  id: string;
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function FormField({
  label,
  id,
  selected = false,
  children,
}: {
  label: string;
  id?: string;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      data-preview-field={id}
      className={`marginalia-field${selected ? " is-selected" : ""}${id ? " is-visited" : ""}`}
    >
      <span>{label}</span>
      {children}
    </div>
  );
}

function Boxes({ labels }: { labels: string[] }) {
  return (
    <span className="marginalia-boxes">
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </span>
  );
}

export function MarginaliaPreview() {
  const { t } = useI18n();
  const copy = t.landingPreview;
  const deskRef = useRef<HTMLDivElement>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    const desk = deskRef.current;
    if (!desk) return;

    const sheet = desk.querySelector<HTMLElement>(".marginalia-sheet");
    const form = desk.querySelector<HTMLElement>(".marginalia-form");
    const list = desk.querySelector<HTMLOListElement>(".marginalia-notes");
    if (!sheet || !form || !list) return;

    const narrow = window.matchMedia("(max-width: 860px)");
    let frame = 0;
    let disposed = false;

    function layout() {
      if (!desk || !list || !sheet || !form) return;

      const notes = Array.from(list.querySelectorAll<HTMLElement>("[data-preview-note]"));
      if (narrow.matches) {
        list.style.height = "";
        notes.forEach((note) => { note.style.top = ""; });
        setLeaders([]);
        return;
      }

      const listRect = list.getBoundingClientRect();
      const deskRect = desk.getBoundingClientRect();
      const sheetRect = sheet.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const next: Leader[] = [];
      let floor = 0;

      for (const note of notes) {
        const id = note.dataset.previewNote;
        const field = desk.querySelector<HTMLElement>(`[data-preview-field="${id}"]`);
        const title = note.querySelector<HTMLElement>("h3");
        if (!id || !field || !title) continue;

        const fieldRect = field.getBoundingClientRect();
        // Measure the resting paper position, not its animated entrance.
        const fieldY = fieldRect.top - formRect.top + sheetRect.top + fieldRect.height / 2;
        const top = Math.max(floor, fieldY - listRect.top - title.offsetHeight / 2);
        note.style.top = `${top}px`;
        floor = top + note.offsetHeight + 28;

        const titleRect = title.getBoundingClientRect();
        const startX = fieldRect.right - formRect.left + sheetRect.left - deskRect.left;
        const startY = fieldY - deskRect.top;
        const endX = titleRect.left - deskRect.left - 10;
        const endY = titleRect.top + titleRect.height / 2 - deskRect.top;
        const middleX = startX + (endX - startX) * 0.55;

        next.push({
          id,
          path: `M${startX} ${startY} C${middleX} ${startY} ${middleX} ${endY} ${endX} ${endY}`,
          startX,
          startY,
          endX,
          endY,
        });
      }

      list.style.height = `${Math.max(0, floor - 28)}px`;
      setLeaders(next);
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(desk);
    observer.observe(sheet);
    list.querySelectorAll("li").forEach((note) => observer.observe(note));
    narrow.addEventListener("change", schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    schedule();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      narrow.removeEventListener("change", schedule);
    };
  }, [copy]);

  const notes = [
    { title: copy.surname, body: <p>{copy.surnameNote}</p>, source: sources[0] },
    {
      title: copy.dob,
      body: (
        <>
          <p>{copy.dobNote}</p>
          <p>
            <span className="block text-[15px] font-bold text-ink-2">{copy.exampleLabel}</span>
            <strong className="text-[18px] text-ink">{copy.dateExample}</strong>
          </p>
        </>
      ),
      source: sources[0],
    },
    {
      title: copy.travel,
      body: (
        <p>
          <span className="block text-[15px] font-bold text-ink-2">{t.mistakes}</span>
          {copy.travelNote}
        </p>
      ),
      source: sources[1],
    },
  ];

  return (
    <div ref={deskRef} className="marginalia-desk">
      <div className="marginalia-sheet" aria-hidden="true">
        <article className="marginalia-form">
          <header className="marginalia-form-head">
            <span>PPTC 153 <em>({copy.facsimile})</em></span>
            <span>{copy.page}</span>
            <h2>{copy.title}</h2>
          </header>

          <div className="marginalia-form-body">
            <h3 className="marginalia-form-bar">{copy.personal}</h3>
            <FormField id="surname" label={copy.surname} />
            <FormField label={copy.given} />
            <div className="marginalia-form-row">
              <FormField label={copy.former} />
              <FormField label={copy.parents} />
            </div>
            <div className="marginalia-form-row marginalia-form-details">
              <FormField id="dob" label={copy.dob} selected>
                <Boxes labels={copy.dateParts} />
              </FormField>
              <FormField label={copy.sex}>
                <span className="marginalia-ticks">
                  {["F", "M", "X"].map((sex) => <span key={sex}>{sex}</span>)}
                </span>
              </FormField>
              <FormField label={copy.eyes} />
              <FormField label={copy.height} />
            </div>
            <FormField label={copy.birthplace}>
              <Boxes labels={copy.placeParts} />
            </FormField>
            <h3 className="marginalia-form-bar">{copy.travelSection}</h3>
            <FormField id="travel" label={copy.travel}>
              <span className="marginalia-ticks">
                <span>{copy.date}</span>
                <span>{copy.unknown}</span>
              </span>
            </FormField>
            <div className="marginalia-form-row">
              {[1, 2].map((n) => (
                <div key={n} className="marginalia-field marginalia-static">{copy.contact} {n}</div>
              ))}
            </div>
            <div className="marginalia-form-row marginalia-form-address">
              {[1, 2, 3].map((n) => (
                <div key={n} className="marginalia-field marginalia-static">{copy.address} {n}</div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <ol className="marginalia-notes">
        {notes.map((note, index) => (
          <li key={noteFields[index]} data-preview-note={noteFields[index]} className="marginalia-note">
            <h3><span className="pr-hl">{note.title}</span></h3>
            {note.body}
            <a href={note.source.url} target="_blank" rel="noopener noreferrer" lang="en">
              {note.source.title}
              <span className="sr-only">{t.opensNewTab}</span>
            </a>
          </li>
        ))}
      </ol>

      <svg className="marginalia-leaders" aria-hidden="true">
        {leaders.map((line) => (
          <g key={line.id}>
            <path className="marginalia-leader-halo" d={line.path} />
            <path className="marginalia-leader" d={line.path} />
            <circle className="marginalia-leader-start" cx={line.startX} cy={line.startY} r="4.5" />
            <circle className="marginalia-leader-end" cx={line.endX} cy={line.endY} r="3" />
          </g>
        ))}
      </svg>
    </div>
  );
}
