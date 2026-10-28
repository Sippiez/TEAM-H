import { NextResponse } from "next/server";

import { reply } from "@/lib/assistant";
import type { ChatRequest } from "@/lib/types";

const MAX_MESSAGE = 1000;
const MAX_FIELDS = 2000;

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.message === "string" && body.message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Message too long" }, { status: 413 });
  }
  if (body.form && (!Array.isArray(body.form.fields) || body.form.fields.length > MAX_FIELDS)) {
    return NextResponse.json({ error: "Invalid form context" }, { status: 400 });
  }
  return NextResponse.json(reply(body));
}
