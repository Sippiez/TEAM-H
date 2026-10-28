import { ExternalLinkIcon } from "lucide-react";

import { cn } from "cn";
import { isAllowedGovUrl } from "@/lib/text";
import type { Resource } from "@/lib/types";

export function ResourceList({ resources, compact }: { resources: Resource[]; compact?: boolean }) {
  const safe = resources.filter((r) => isAllowedGovUrl(r.url));
  if (safe.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {safe.map((r) => (
        <li key={r.id}>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex gap-2 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              compact && "p-2",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-medium group-hover:underline">
                <span className="truncate">{r.title}</span>
              </div>
              <div className="text-xs text-muted-foreground">{r.department}</div>
              {!compact && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
            </div>
            <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">(opens canada.ca in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
