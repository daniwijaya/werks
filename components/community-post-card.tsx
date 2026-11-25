"use client";

import Image from "next/image";
import { Bookmark, ExternalLink, Heart, ImageOff, MoreHorizontal, Share2 } from "lucide-react";
import { useState } from "react";
import type { CommunityPost } from "@/types/community-post";

export function CommunityPostCard({ post, fixture = false }: { post: CommunityPost; fixture?: boolean }) {
  const [appreciated, setAppreciated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [message, setMessage] = useState("");

  async function sharePost() {
    const url = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}#${post.id}`;
    try {
      if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied. Sharing is local to this preview.");
      } else setMessage("Sharing is a local preview; no post has been published.");
    } catch { setMessage("Sharing is a local preview; no post has been published."); }
  }

  return (
    <article className="community-post-card" id={post.id} aria-label={`Post by ${post.authorName}`}>
      {fixture && <span className="community-fixture-label">Development preview</span>}
      <header className="community-post-header">
        <div className="community-avatar" aria-hidden="true">{post.authorInitials}</div>
        <div className="community-post-byline">
          <strong>{post.authorName}</strong>
          <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
        </div>
        {post.category && <span className="community-post-category">{post.category}</span>}
        <details className="community-more-menu">
          <summary aria-label="More post actions"><MoreHorizontal size={19} /></summary>
          <div className="community-menu-items">
            {post.isOwner && <>
              <button type="button" onClick={() => setMessage("Editing is not connected yet.")}>Edit post</button>
              <button type="button" onClick={() => setMessage("Deleting is not connected yet.")}>Delete post</button>
            </>}
            <button type="button" onClick={() => setMessage("Reporting is not connected yet.")}>Report post</button>
          </div>
        </details>
      </header>

      <div className="community-post-body">
        <div className="community-post-copy">
          <p>{post.text}</p>
          {post.externalUrl && <a className="community-post-link" href={post.externalUrl} target="_blank" rel="noopener noreferrer">
            <span>{post.externalLinkText || post.externalUrl.replace(/^https?:\/\//, "")}</span><ExternalLink size={15} aria-label="Opens in a new tab" />
          </a>}
        </div>
        {post.imageUrl && <div className="community-post-image">
          {!imageFailed ? <Image src={post.imageUrl} alt="Image attached to this community post" fill sizes="(max-width: 700px) 90vw, 760px" onError={() => setImageFailed(true)} /> : <div className="community-image-fallback" role="img" aria-label="Attached image unavailable"><ImageOff size={22} /><span>Image unavailable</span></div>}
        </div>}
      </div>

      <footer className="community-post-actions" aria-label="Post actions">
        <button type="button" aria-label={appreciated ? "Remove appreciation" : "Appreciate post"} aria-pressed={appreciated} onClick={() => setAppreciated(!appreciated)}><Heart size={17} fill={appreciated ? "currentColor" : "none"} /> <span>{appreciated ? "Appreciated" : "Appreciate"}</span></button>
        <button type="button" aria-label={saved ? "Remove from saved posts" : "Save post"} aria-pressed={saved} onClick={() => setSaved(!saved)}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /> <span>{saved ? "Saved locally" : "Save"}</span></button>
        <button type="button" aria-label="Share post" onClick={sharePost}><Share2 size={17} /> <span>Share</span></button>
      </footer>
      {message && <p className="community-action-message" role="status">{message}</p>}
    </article>
  );
}
