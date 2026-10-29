/** Paper Route control styles (see DESIGN.md › Components). */

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] font-bold text-ink transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-45";

export const btnPrimary = `${base} min-h-12 border-ink bg-highlighter px-3.5 hover:bg-highlighter-deep disabled:hover:bg-highlighter`;

export const btnSecondary = `${base} min-h-12 border-quiet-stroke bg-paper px-3.5 hover:border-ink hover:bg-hover-wash disabled:hover:border-quiet-stroke disabled:hover:bg-paper`;

/** Plain ink-bordered paper button; fills with highlighter on hover. */
export const btnPaper = `${base} min-h-11 border-ink bg-paper px-4 hover:bg-highlighter`;

export const chip =
  "inline-flex min-h-10 cursor-pointer items-center rounded-full border border-quiet-stroke bg-paper px-3 py-1 text-left text-[15px] font-semibold text-ink hover:border-ink hover:bg-highlighter disabled:cursor-progress disabled:opacity-55";

export const textInput =
  "min-h-12 w-full min-w-0 rounded-md border-[1.5px] border-control-stroke bg-paper px-3.5 text-ink";

export const card = "bg-paper shadow-card";
