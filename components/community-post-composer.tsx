"use client";

import { Check, ChevronDown, ImagePlus, Link2, Send, Tag, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { communityCategories } from "@/types/community-post";
import { canPreviewCommunityPost, COMMUNITY_POST_CHAR_LIMIT, isValidCommunityUrl } from "@/lib/community-feed";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DRAFT_KEY = "werks-community-post-draft-v1";

export function CommunityPostComposer() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkTextDraft, setLinkTextDraft] = useState("");
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tagPickerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) {
        const saved = JSON.parse(draft) as { text?: string; url?: string; linkText?: string };
        setText(typeof saved.text === "string" ? saved.text.slice(0, COMMUNITY_POST_CHAR_LIMIT) : "");
        setUrl(typeof saved.url === "string" ? saved.url : "");
        setLinkText(typeof saved.linkText === "string" ? saved.linkText : "");
      }
    } catch { /* session storage is optional */ }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ text, url, linkText })); } catch { /* draft remains in memory */ }
  }, [text, url, linkText, draftReady]);

  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    function closeTagMenuOutside(event: PointerEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(event.target as Node)) tagPickerRef.current.open = false;
    }
    function closeTagMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && tagPickerRef.current?.open) {
        tagPickerRef.current.open = false;
        tagPickerRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeTagMenuOutside);
    document.addEventListener("keydown", closeTagMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeTagMenuOutside);
      document.removeEventListener("keydown", closeTagMenuOnEscape);
    };
  }, []);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview); }, [image]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setNotice("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setNotice("Image must be 5 MB or smaller.");
      return;
    }
    setNotice("");
    setImage({ file, preview: URL.createObjectURL(file) });
  }

  function removeImage() {
    setImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function openLinkEditor() {
    setLinkTextDraft(linkText);
    setLinkUrlDraft(url);
    setNotice("");
    setLinkOpen((open) => !open);
  }

  function insertLink() {
    if (!linkUrlDraft.trim() || !isValidCommunityUrl(linkUrlDraft)) {
      setNotice("Enter a valid http:// or https:// link.");
      return;
    }
    setUrl(linkUrlDraft.trim());
    setLinkText(linkTextDraft.trim());
    setLinkOpen(false);
    setNotice("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPreviewCommunityPost(text, url, Boolean(image))) {
      setNotice(url && !isValidCommunityUrl(url) ? "Enter a valid http:// or https:// link." : "Add a message, link, or image before continuing.");
      return;
    }
    setNotice("Preview only. Posting is not connected yet, so nothing has been published.");
  }

  return (
    <section className="community-composer" aria-labelledby="community-composer-heading">
      <div className="community-composer-title">
        <h2 id="community-composer-heading">Share an opportunity</h2>
        <span className="community-local-badge">Local draft</span>
      </div>
      <form onSubmit={submit}>
        <div className="community-composer-main">
          <div className="community-composer-fields">
            <label className="visually-hidden" htmlFor="community-post-text">Write a message</label>
            <textarea
              id="community-post-text"
              ref={textareaRef}
              value={text}
              maxLength={COMMUNITY_POST_CHAR_LIMIT}
              onChange={(event) => { setText(event.target.value); setNotice(""); }}
              placeholder="Share a job opportunity with the creative community…"
              rows={2}
            />
            <div className="community-composer-meta">
              <span className={text.length >= COMMUNITY_POST_CHAR_LIMIT * 0.9 ? "community-counter is-near-limit" : "community-counter"} aria-live="polite">{text.length}/{COMMUNITY_POST_CHAR_LIMIT}</span>
            </div>

            <div className="community-composer-attachments">
              <p className="community-insert-label">Insert:</p>
              <div className="community-attach-controls">
                <button className="community-tool-button" type="button" onClick={() => imageInputRef.current?.click()} aria-label={image ? "Replace image" : "Attach image"}>
                  <ImagePlus size={17} aria-hidden="true" /> Image
                </button>
                <div className="community-link-control">
                  <button className="community-tool-button community-link-button" type="button" onClick={openLinkEditor} aria-expanded={linkOpen} aria-controls="community-link-editor">
                    <Link2 size={16} aria-hidden="true" /> Link
                  </button>
                  {linkOpen && <div className="community-link-editor" id="community-link-editor">
                    <label htmlFor="community-link-text">Text to display</label>
                    <input id="community-link-text" type="text" value={linkTextDraft} onChange={(event) => setLinkTextDraft(event.target.value)} placeholder="Optional link text" />
                    <label htmlFor="community-link-url">Web address</label>
                    <input id="community-link-url" type="url" value={linkUrlDraft} onChange={(event) => setLinkUrlDraft(event.target.value)} placeholder="https://example.com" />
                    <div className="community-link-editor-actions">
                      {url && <button className="community-remove-link" type="button" onClick={() => { setUrl(""); setLinkText(""); setLinkOpen(false); }}>Remove link</button>}
                      <button className="community-cancel-link" type="button" onClick={() => setLinkOpen(false)}>Cancel</button>
                      <button className="community-insert-link" type="button" onClick={insertLink}>Insert</button>
                    </div>
                  </div>}
                </div>
                <details ref={tagPickerRef} className="community-tag-picker">
                  <summary className="community-tool-button community-tag-trigger" aria-label={`Tag: ${category || "Tag"}`}>
                    <Tag size={16} aria-hidden="true" /><span>{category || "Tag"}</span><ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <div className="community-tag-menu" role="menu" aria-label="Choose a tag">
                    <button type="button" role="menuitemradio" aria-checked={!category} className="community-tag-option" onClick={() => { setCategory(""); if (tagPickerRef.current) tagPickerRef.current.open = false; }}>
                      <span>Tag</span>{!category && <Check size={15} aria-hidden="true" />}
                    </button>
                    {communityCategories.map((item) => <button key={item} type="button" role="menuitemradio" aria-checked={category === item} className="community-tag-option" onClick={() => { setCategory(item); if (tagPickerRef.current) tagPickerRef.current.open = false; }}>
                      <span>{item}</span>{category === item && <Check size={15} aria-hidden="true" />}
                    </button>)}
                  </div>
                </details>
                <button className="community-post-button" type="submit"><Send size={16} aria-hidden="true" /> Post</button>
              </div>
              <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Choose an image, up to 5 MB" />
              {image && <div className="community-image-preview">
                {/* Local object URL preview only; no upload occurs in this phase. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.preview} alt={`Local preview: ${image.file.name}`} />
                <span>{image.file.name}</span>
                <button type="button" onClick={removeImage} aria-label="Remove image"><X size={16} /></button>
              </div>}
            </div>
            <div className="community-composer-footer">
              <p className="community-composer-hint">Drafts stay in this browser. Images are previewed locally and are not uploaded.</p>
            </div>
          </div>
        </div>
        {notice && <p className="community-form-notice" role="status">{notice}</p>}
      </form>
    </section>
  );
}
