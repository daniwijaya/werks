"use client";

import { communityCategories, type CommunityCategory, type CommunityPost } from "@/types/community-post";
import { filterCommunityPosts } from "@/lib/community-feed";
import { CommunityPostCard } from "@/components/community-post-card";
import { useState } from "react";

export type CommunityFeedState = "ready" | "loading" | "empty" | "error";

export function CommunityFeed({
  posts,
  developmentPreview = false,
  state = "ready",
}: {
  posts: CommunityPost[];
  developmentPreview?: boolean;
  state?: CommunityFeedState;
}) {
  const [category, setCategory] = useState<"All" | CommunityCategory>("All");
  const [visibleCount, setVisibleCount] = useState(5);
  const matches = filterCommunityPosts(posts, category);
  const visiblePosts = matches.slice(0, visibleCount);

  return (
    <section className="community-feed" aria-labelledby="community-feed-heading">
      <div className="community-feed-heading-row">
        <div>
          <p className="community-eyebrow">Creative community</p>
          <h2 id="community-feed-heading">Latest opportunities</h2>
        </div>
        <span className="community-feed-count" aria-live="polite">{state === "ready" ? `${matches.length} ${matches.length === 1 ? "post" : "posts"}` : ""}</span>
      </div>
      <div className="community-category-list" role="group" aria-label="Filter posts by category">
        <button type="button" className={category === "All" ? "is-selected" : ""} aria-pressed={category === "All"} onClick={() => { setCategory("All"); setVisibleCount(5); }}>All</button>
        {communityCategories.map((item) => <button key={item} type="button" className={category === item ? "is-selected" : ""} aria-pressed={category === item} onClick={() => { setCategory(item); setVisibleCount(5); }}>{item}</button>)}
      </div>

      {developmentPreview && <p className="community-dev-banner" role="note">Development preview — the examples below are fictional UI fixtures and are not real job listings.</p>}

      {state === "loading" ? <div className="community-feed-state" role="status"><span className="community-loading-dot" />Loading community posts…</div>
        : state === "error" ? <div className="community-feed-state is-error" role="alert"><strong>Posts are temporarily unavailable.</strong><span>Please try again later.</span></div>
          : state === "empty" || visiblePosts.length === 0 ? <div className="community-feed-state"><strong>No posts yet</strong><span>Be the first to share an opportunity with the community.</span></div>
            : <div className="community-post-list">{visiblePosts.map((post) => <CommunityPostCard key={post.id} post={post} fixture={developmentPreview} />)}</div>}

      {state === "ready" && visibleCount < matches.length && <button className="community-load-more" type="button" onClick={() => setVisibleCount((count) => count + 5)}>Show more posts</button>}
    </section>
  );
}
