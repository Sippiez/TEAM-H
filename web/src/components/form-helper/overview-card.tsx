import type { FormOverview } from "@/lib/types";

import { englishOnly, useI18n } from "./i18n";
import { ResourceList } from "./resource-list";

export function OverviewCard({ overview }: { overview: FormOverview }) {
  const { lang, t } = useI18n();
  const en = englishOnly(lang);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[19px]">{t.overviewTitle(overview.title)}</h3>
      <p className="text-[15px] text-ink-2 tabular-nums">
        {[overview.formNumber, overview.department].filter(Boolean).join(" · ")}
        {(overview.formNumber || overview.department) && " · "}
        {t.pagesFields(overview.pageCount, overview.fieldCount)}
      </p>
      <p lang={en}>{overview.summary}</p>
      <dl className="flex flex-col gap-2.5">
        {overview.whoFiles && (
          <div>
            <dt className="font-extrabold">{t.whoUses}</dt>
            <dd lang={en}>{overview.whoFiles}</dd>
          </div>
        )}
        {overview.youNeed.length > 0 && (
          <div>
            <dt className="font-extrabold">{overview.curated ? t.youNeed : t.sectionsFound}</dt>
            <dd lang={en}>
              <ul className="list-disc pl-[1.3em]">
                {overview.youNeed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {overview.howToSubmit && (
          <div>
            <dt className="font-extrabold">{t.howToSubmit}</dt>
            <dd lang={en}>{overview.howToSubmit}</dd>
          </div>
        )}
      </dl>
      {overview.resources.length > 0 && <ResourceList resources={overview.resources} compact className="mt-1" />}
    </div>
  );
}
