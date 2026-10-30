import { cn } from "cn";
import { isAllowedGovUrl } from "@/lib/text";
import { isGoogleGroundingRedirect } from "@/lib/official/hosts";
import type { Resource, SourceProvenance } from "@/lib/types";

import { englishOnly, useI18n } from "./i18n";

/** Official sources as pencil-blue links. Only allow-listed government URLs render. */
export function ResourceList({
  resources,
  compact,
  className,
}: {
  resources: Resource[];
  compact?: boolean;
  className?: string;
}) {
  const { lang, t } = useI18n();
  const safe = resources.filter((r) => isAllowedGovUrl(r.url) &&
    (!r.citationUrl || r.citationUrl === r.url ||
      (r.provenance?.kind === "google_grounded" && isGoogleGroundingRedirect(r.citationUrl))));
  if (safe.length === 0) return null;
  const provenanceLabel = (resource: Resource) => {
    const provenance: SourceProvenance =
      resource.provenance ?? { kind: "saved_guidance", reviewedAt: null };
    if (provenance.kind === "live_official") {
      return t.liveSource(new Intl.DateTimeFormat(
        lang === "fr" ? "fr-CA" : "en-CA",
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(provenance.retrievedAt)));
    }
    if (provenance.kind === "google_grounded") {
      return t.googleGroundedSource(new Intl.DateTimeFormat(
        lang === "fr" ? "fr-CA" : "en-CA",
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(provenance.searchedAt)));
    }
    if (provenance.kind === "reviewed_snapshot") {
      return t.reviewedSnapshot(provenance.reviewedAt);
    }
    return t.unreviewedSavedGuidance;
  };
  return (
    <ul className={cn("flex flex-col", className)}>
      {safe.map((r, index) => (
        <li key={r.id} className="relative flex flex-col gap-0.5 border-t border-rule-2 py-2 first:border-t-0 first:pt-0.5">
          <a href={r.citationUrl ?? r.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
            <span lang={r.language ?? (r.provenance?.kind === "google_grounded" ? undefined : englishOnly(lang))}>
              {(r.provenance?.kind === "live_official" || r.provenance?.kind === "google_grounded") && <span>[{index + 1}] </span>}
              {r.title}
            </span>
            <span className="sr-only">{t.opensNewTab}</span>
          </a>
          <span lang={r.language ?? (r.provenance?.kind === "google_grounded" ? undefined : englishOnly(lang))} className="text-[15px] text-ink-2">
            {new URL(r.url).hostname} · {r.department}
          </span>
          {!compact && r.description && (
            <span lang={r.language ?? (r.provenance?.kind === "google_grounded" ? undefined : englishOnly(lang))} className="text-[15px] text-ink-2">
              {r.description}
            </span>
          )}
          <span className="text-[13px] text-ink-2">{provenanceLabel(r)}</span>
        </li>
      ))}
    </ul>
  );
}
