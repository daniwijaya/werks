import type { CommunityCategory, CommunityPost } from "@/types/community-post";

export const COMMUNITY_POST_CHAR_LIMIT = 1000;

export function filterCommunityPosts(
  posts: CommunityPost[],
  category: "All" | CommunityCategory,
): CommunityPost[] {
  if (category === "All") return posts;
  return posts.filter((post) => post.category === category);
}

export function isValidCommunityUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function canPreviewCommunityPost(text: string, url: string, hasImage: boolean): boolean {
  return Boolean(text.trim() || url.trim() || hasImage)
    && text.length <= COMMUNITY_POST_CHAR_LIMIT
    && isValidCommunityUrl(url);
}

/** Keep fictional examples out of production even if fixtures are imported elsewhere. */
export function getHomepageCommunityPosts(
  nodeEnvironment: string | undefined,
  developmentFixtures: CommunityPost[],
): { posts: CommunityPost[]; developmentPreview: boolean } {
  const developmentPreview = nodeEnvironment === "development";
  return { posts: developmentPreview ? developmentFixtures : [], developmentPreview };
}
