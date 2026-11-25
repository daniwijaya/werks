"use client";

import type { CommunityPost } from "@/types/community-post";
import { CommunityFeed } from "@/components/community-feed";
import { CommunityPostComposer } from "@/components/community-post-composer";

export function CommunityExperience({ posts, developmentPreview }: { posts: CommunityPost[]; developmentPreview: boolean }) {
  return <main className="community-content wrap">
    <CommunityPostComposer />
    <CommunityFeed posts={posts} developmentPreview={developmentPreview} />
  </main>;
}
