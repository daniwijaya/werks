import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { communityPostFixtures } from "../data/community-post-fixtures.ts";
import {
  canPreviewCommunityPost,
  COMMUNITY_POST_CHAR_LIMIT,
  filterCommunityPosts,
  getHomepageCommunityPosts,
  isValidCommunityUrl,
} from "../lib/community-feed.ts";

const nativeRequire = createRequire(import.meta.url);
function loadTsx<T>(relativePath: string, mocks: Record<string, unknown> = {}): T {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", output)((name: string) => name in mocks ? mocks[name] : nativeRequire(name), exports);
  return exports as T;
}
const Icon = () => null;
const iconMocks = { Check: Icon, ChevronDown: Icon, ImagePlus: Icon, Link2: Icon, Send: Icon, Tag: Icon, X: Icon, Bookmark: Icon, ExternalLink: Icon, Heart: Icon, ImageOff: Icon, MoreHorizontal: Icon, Share2: Icon };
const MockImage = ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt });
const composerLibMocks = {
  COMMUNITY_POST_CHAR_LIMIT,
  canPreviewCommunityPost,
  isValidCommunityUrl,
};
const { CommunityPostComposer } = loadTsx<{ CommunityPostComposer: () => React.ReactNode }>(
  "../components/community-post-composer.tsx",
  {
    "lucide-react": iconMocks,
    "@/types/community-post": { communityCategories: ["Product Design", "UI/UX Design", "UX Research", "Graphic Design", "Brand Design", "Motion Design", "Illustration", "Others"] },
    "@/lib/community-feed": composerLibMocks,
  },
);
const { CommunityPostCard } = loadTsx<{ CommunityPostCard: (props: { post: typeof communityPostFixtures[number]; fixture?: boolean }) => React.ReactNode }>(
  "../components/community-post-card.tsx",
  { "next/image": { default: MockImage }, "lucide-react": iconMocks, "@/types/community-post": {} },
);
const MockCard = ({ post, fixture }: { post: typeof communityPostFixtures[number]; fixture?: boolean }) => createElement("article", { "data-post": post.id, "data-fixture": fixture });
const { CommunityFeed } = loadTsx<{ CommunityFeed: (props: { posts: typeof communityPostFixtures; developmentPreview?: boolean; state?: "ready" | "loading" | "empty" | "error" }) => React.ReactNode }>(
  "../components/community-feed.tsx",
  {
    "@/components/community-post-card": { CommunityPostCard: MockCard },
    "@/lib/community-feed": { filterCommunityPosts },
    "@/types/community-post": { communityCategories: ["Product Design", "UI/UX Design", "UX Research", "Graphic Design", "Brand Design", "Motion Design", "Illustration", "Others"] },
  },
);

test("fictional homepage fixture posts are passed only in development", () => {
  const dev = getHomepageCommunityPosts("development", communityPostFixtures);
  assert.equal(dev.developmentPreview, true);
  assert.equal(dev.posts.length, communityPostFixtures.length);
  for (const env of ["production", "test", undefined]) {
    const result = getHomepageCommunityPosts(env, communityPostFixtures);
    assert.equal(result.developmentPreview, false);
    assert.deepEqual(result.posts, []);
  }
});

test("category filtering retains uncategorized posts only under All", () => {
  const all = filterCommunityPosts(communityPostFixtures, "All");
  assert.equal(all.length, 7);
  assert.equal(filterCommunityPosts(communityPostFixtures, "Product Design").length, 1);
  assert.equal(filterCommunityPosts(communityPostFixtures, "Others").length, 0);
});

test("post links accept only HTTP and HTTPS URLs", () => {
  assert.equal(isValidCommunityUrl(""), true);
  assert.equal(isValidCommunityUrl("https://example.com/role"), true);
  assert.equal(isValidCommunityUrl("http://example.com"), true);
  assert.equal(isValidCommunityUrl("javascript:alert(1)"), false);
  assert.equal(isValidCommunityUrl("not a URL"), false);
});

test("composer preview validates content and the 1000 character limit", () => {
  assert.equal(canPreviewCommunityPost("", "", false), false);
  assert.equal(canPreviewCommunityPost("Hello", "", false), true);
  assert.equal(canPreviewCommunityPost("", "https://example.com", false), true);
  assert.equal(canPreviewCommunityPost("", "", true), true);
  assert.equal(COMMUNITY_POST_CHAR_LIMIT, 1000);
  assert.equal(canPreviewCommunityPost("x".repeat(1000), "", false), true);
  assert.equal(canPreviewCommunityPost("x".repeat(201), "", false), false);
  assert.equal(canPreviewCommunityPost("hello", "javascript:alert(1)", false), false);
});

test("development fixtures cover text, links, images, long text, no category, and missing image", () => {
  assert.ok(communityPostFixtures.some((post) => !post.imageUrl && !post.externalUrl));
  assert.ok(communityPostFixtures.some((post) => post.externalUrl && !post.imageUrl));
  assert.ok(communityPostFixtures.some((post) => post.imageUrl && !post.externalUrl));
  assert.ok(communityPostFixtures.some((post) => post.imageUrl && post.externalUrl));
  assert.ok(communityPostFixtures.some((post) => post.text.length > 500));
  assert.ok(communityPostFixtures.some((post) => !post.category));
  assert.ok(communityPostFixtures.some((post) => post.imageUrl?.includes("not-found")));
  assert.ok(communityPostFixtures.every((post) => post.text.includes("[DEVELOPMENT FIXTURE]")));
});

test("tag dropdown starts at Tag, displays Others, and the composer limit is 1000", () => {
  const html = renderToStaticMarkup(createElement(CommunityPostComposer));
  assert.match(html, /aria-label="Tag: Tag"/);
  assert.match(html, /<span>Tag<\/span>/);
  assert.match(html, /<span>Others<\/span>/);
  assert.doesNotMatch(html, /Other Creative Roles/);
  assert.match(html, /maxLength="?1000/);
  assert.match(html, /0\/1000/);
});

test("post card renders a crawlable original link and explicit local actions", () => {
  const html = renderToStaticMarkup(createElement(CommunityPostCard, { post: communityPostFixtures[1], fixture: true }));
  assert.match(html, /Development preview/);
  assert.match(html, /href="https:\/\/example.com\/fictional-uiux-role"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Appreciate/);
});

test("community feed labels development fixtures and has loading, empty, and error states", () => {
  const fixtureHtml = renderToStaticMarkup(createElement(CommunityFeed, { posts: communityPostFixtures, developmentPreview: true }));
  assert.match(fixtureHtml, /Development preview — the examples below are fictional UI fixtures/);
  assert.match(fixtureHtml, /data-fixture="true"/);

  const loadingHtml = renderToStaticMarkup(createElement(CommunityFeed, { posts: [], state: "loading" }));
  assert.match(loadingHtml, /Loading community posts/);
  const emptyHtml = renderToStaticMarkup(createElement(CommunityFeed, { posts: [], state: "empty" }));
  assert.match(emptyHtml, /No posts yet/);
  const errorHtml = renderToStaticMarkup(createElement(CommunityFeed, { posts: [], state: "error" }));
  assert.match(errorHtml, /Posts are temporarily unavailable/);
});
