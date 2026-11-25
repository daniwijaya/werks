export const communityCategories = [
  "Product Design",
  "UI/UX Design",
  "UX Research",
  "Graphic Design",
  "Brand Design",
  "Motion Design",
  "Illustration",
  "Others",
] as const;

export type CommunityCategory = typeof communityCategories[number];

export type CommunityPost = {
  id: string;
  authorName: string;
  authorInitials: string;
  publishedLabel: string;
  publishedAt: string;
  text: string;
  category?: CommunityCategory;
  imageUrl?: string;
  externalUrl?: string;
  externalLinkText?: string;
  isOwner?: boolean;
};

export type ModerationPresentationState =
  | "checking"
  | "published"
  | "revision_required"
  | "rejected"
  | "pending"
  | "unavailable";
