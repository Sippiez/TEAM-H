import { NextResponse } from "next/server";

import { explainField } from "@/lib/explain";
import { isFieldSummary } from "@/lib/field-context";
import type { ExplainRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: ExplainRequest;
  try {
    body = (await request.json()) as ExplainRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const f = body?.field;
  if (!isFieldSummary(f)) {
    return NextResponse.json({ error: "Missing field" }, { status: 400 });
  }
  return NextResponse.json(explainField(f, body.formNumber));
}
