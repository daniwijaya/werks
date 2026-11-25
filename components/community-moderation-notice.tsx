import type { ModerationPresentationState } from "@/types/community-post";

const copy: Record<ModerationPresentationState, { title: string; detail: string }> = {
  checking: { title: "Checking your post", detail: "It has not been added to the community feed yet." },
  published: { title: "Post approved", detail: "Your post is visible in the community feed." },
  revision_required: { title: "Changes requested", detail: "Please review the moderation feedback before resubmitting." },
  rejected: { title: "Post not approved", detail: "This post was not added to the community feed." },
  pending: { title: "Awaiting review", detail: "Your post has not been published yet." },
  unavailable: { title: "Review status unavailable", detail: "We could not retrieve the latest moderation status." },
};

/** Prepared UI for a future moderation service; no state is fabricated in this phase. */
export function CommunityModerationNotice({ state }: { state: ModerationPresentationState }) {
  const message = copy[state];
  return <div className={`community-moderation-notice is-${state}`} role={state === "unavailable" ? "alert" : "status"}>
    <strong>{message.title}</strong><span>{message.detail}</span>
  </div>;
}
