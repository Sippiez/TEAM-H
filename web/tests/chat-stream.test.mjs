import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/chat-stream.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, {
  exports,
  require(name) { throw new Error(`Unexpected import: ${name}`); },
  TextDecoder,
  ReadableStream,
}, { filename: "../src/lib/chat-stream.ts" });

test("SSE parser survives byte-by-byte UTF-8 and frame boundaries", async () => {
  const text = [
    `data: ${JSON.stringify({ version: 1, type: "delta", text: "Québec 😀" })}\r\n\r\n`,
    `data: ${JSON.stringify({
      version: 1,
      type: "lookup",
      outcome: { status: "unavailable", reason: "provider_not_configured", partial: false },
      sources: [],
    })}\n\n`,
    `data: ${JSON.stringify({ version: 1, type: "complete", complete: true })}`,
  ].join("");
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const events = [];
  for await (const event of exports.readChatEvents(body)) events.push(event);
  assert.deepEqual(
    JSON.parse(JSON.stringify(events)),
    [
      { version: 1, type: "delta", text: "Québec 😀" },
      {
        version: 1,
        type: "lookup",
        outcome: { status: "unavailable", reason: "provider_not_configured", partial: false },
        sources: [],
      },
      { version: 1, type: "complete", complete: true },
    ],
  );
});

test("SSE parser rejects unsupported versions and cancels abandoned streams", async () => {
  const invalidBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ version: 2, type: "complete", complete: true })}\n\n`,
      ));
      controller.close();
    },
  });
  const invalidIterator = exports.readChatEvents(invalidBody);
  await assert.rejects(invalidIterator.next(), /Unsupported chat stream event/);

  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ version: 1, type: "delta", text: "partial" })}\n\n`,
      ));
    },
    cancel() { cancelled = true; },
  });
  const iterator = exports.readChatEvents(body);
  assert.equal((await iterator.next()).value.text, "partial");
  await iterator.return();
  assert.equal(cancelled, true);
});
