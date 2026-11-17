"use client";

import { useId, useState } from "react";

import {
  JURISDICTION_IDS,
  type LookupContext,
} from "@/lib/official/catalog";
import { JURISDICTIONS } from "@/lib/official/hosts";
import { getServiceResources } from "@/lib/catalog/resources";
import type { OfficialLookupSummary, Resource } from "@/lib/types";

import { useI18n } from "./i18n";
import { ResourceList } from "./resource-list";
import { btnSecondary, textInput } from "./styles";

export function LookupRecovery({
  outcome,
  disabled,
  onResolve,
}: {
  outcome: OfficialLookupSummary;
  disabled: boolean;
  onResolve?: (choice: LookupContext, label: string) => void;
}) {
  const { lang, t } = useI18n();
  const [choice, setChoice] = useState("");
  const choiceId = useId();
  if (outcome.status === "verified") return null;
  if (outcome.status === "clarification_required") {
    if (!outcome.serviceId && !outcome.publicForm) return null;
    const label = outcome.publicForm ? t.chooseFormJurisdiction : t.chooseJurisdiction;
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const jurisdiction = JURISDICTION_IDS.find((id) => id === choice);
          if (jurisdiction) {
            const place = JURISDICTIONS[jurisdiction];
            onResolve?.({ jurisdiction }, lang === "fr" ? place.labelFr : place.label);
          }
        }}
      >
        <label htmlFor={choiceId} className="text-[15px] font-bold">
          {label}
        </label>
        <select
          id={choiceId}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={`${textInput} w-full min-w-0`}
          disabled={disabled}
          required
        >
          <option value="">{t.selectOption}</option>
          {JURISDICTION_IDS.filter((id) => outcome.publicForm || id !== "federal").map((id) => (
                <option key={id} value={id}>
                  {lang === "fr" ? JURISDICTIONS[id].labelFr : JURISDICTIONS[id].label}
                </option>
              ))}
        </select>
        <button type="submit" className={`${btnSecondary} self-start`} disabled={disabled || !choice}>
          {t.continueLookup}
        </button>
      </form>
    );
  }
  const saved = outcome.serviceId && outcome.jurisdiction
    ? getServiceResources(outcome.serviceId, outcome.facetId, outcome.jurisdiction, outcome.passportMode)
    : [];
  const jurisdiction = outcome.jurisdiction ? JURISDICTIONS[outcome.jurisdiction] : undefined;
  const resources: Resource[] = saved.length || !jurisdiction
    ? saved
    : [{
        id: `saved-${outcome.jurisdiction}`,
        title: t.officialWebsite(lang === "fr" ? jurisdiction.labelFr : jurisdiction.label),
        url: `https://${jurisdiction.root}/`,
        department: lang === "fr" ? jurisdiction.labelFr : jurisdiction.label,
        language: lang === "fr" ? "fr-CA" : "en-CA",
        description: "",
        tags: [],
        provenance: { kind: "saved_guidance", reviewedAt: null },
      }];
  return resources.length > 0 ? (
    <div className="flex flex-col gap-2 border-t border-rule-2 pt-3">
      <p className="text-[15px] font-bold">{t.savedLinks}</p>
      <ResourceList resources={resources} compact />
    </div>
  ) : null;
}
