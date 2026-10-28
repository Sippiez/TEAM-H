import { CheckCircle2Icon, FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormOverview } from "@/lib/types";

import { ResourceList } from "./resource-list";

export function OverviewCard({ overview }: { overview: FormOverview }) {
  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
          {overview.formNumber && <Badge variant="secondary">{overview.formNumber}</Badge>}
          {overview.department && <Badge variant="outline">{overview.department}</Badge>}
        </div>
        <CardTitle>{overview.title}</CardTitle>
        <CardDescription>
          {overview.pageCount} pages · {overview.fieldCount} fillable fields
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{overview.summary}</p>
        {overview.whoFiles && (
          <p>
            <span className="font-medium">Who uses it: </span>
            {overview.whoFiles}
          </p>
        )}
        {overview.youNeed.length > 0 && (
          <div>
            <div className="mb-1 font-medium">{overview.curated ? "You'll need" : "Sections found"}</div>
            <ul className="space-y-1">
              {overview.youNeed.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {overview.howToSubmit && (
          <p>
            <span className="font-medium">How to submit: </span>
            {overview.howToSubmit}
          </p>
        )}
        {overview.resources.length > 0 && (
          <div>
            <div className="mb-1 font-medium">Official resources</div>
            <ResourceList resources={overview.resources} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
