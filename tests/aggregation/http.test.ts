import assert from "node:assert/strict";
import test from "node:test";
import { requestWithRetry } from "../../lib/aggregation/http.ts";

test("requestWithRetry rejects redirects outside registered company domains before following them", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url === "https://careers.example.id/feed") return new Response(null, { status: 302, headers: { location: "https://evil.invalid/steal" } });
    return new Response("unexpected", { status: 200 });
  };
  await assert.rejects(() => requestWithRetry("https://careers.example.id/feed", {
    fetchImpl,
    redirectValidator: (url) => new URL(url).hostname === "careers.example.id",
  }), /outside registered allowed domains/);
  assert.deepEqual(requested, ["https://careers.example.id/feed"]);
});

test("requestWithRetry follows permitted redirects", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("/feed")) return new Response(null, { status: 301, headers: { location: "/jobs.xml" } });
    return new Response("<rss/>", { status: 200 });
  };
  const response = await requestWithRetry("https://careers.example.id/feed", {
    fetchImpl,
    redirectValidator: (url) => new URL(url).hostname === "careers.example.id",
  });
  assert.equal(response.status, 200);
  assert.equal(requested.length, 2);
});
