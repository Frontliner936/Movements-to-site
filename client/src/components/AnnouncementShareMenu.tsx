import React, { useEffect, useId, useRef, useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { FaFacebookF, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { createAnnouncementShareInfo } from "@/lib/jobSharing";

const brandIcons = {
  whatsapp: FaWhatsapp,
  facebook: FaFacebookF,
  x: FaXTwitter,
  linkedin: FaLinkedinIn,
  telegram: FaTelegram,
} as const;

export function AnnouncementShareMenu({ announcement }: { announcement: { id: number; title: string } }) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const controlRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const shareInfo = createAnnouncementShareInfo(announcement, window.location.origin);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareInfo.url);
      else {
        const input = document.createElement("textarea");
        input.value = shareInfo.url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Could not copy the link.");
    }
  }

  return <div className="job-share-control announcement-share-control" ref={controlRef} data-open={open}>
    <button type="button" className="secondary-button job-share-trigger announcement-share-trigger" aria-label={`Share announcement: ${announcement.title}`} aria-expanded={open} aria-controls={menuId} aria-haspopup="true" onClick={() => { setOpen(value => !value); setCopyStatus(""); }}>
      <Share2 size={14} /><span>Share</span>
    </button>
    {open && <div className="job-share-popover" id={menuId} role="region" aria-label={`Share announcement: ${announcement.title}`}>
      <strong className="job-share-heading">Share this announcement</strong>
      <div className="job-share-social-grid" role="group" aria-label="Social media platforms">
        {shareInfo.destinations.map(destination => {
          const BrandIcon = brandIcons[destination.id];
          return <a key={destination.id} className={`job-share-social-link job-share-${destination.id}`} href={destination.href} target="_blank" rel="noopener noreferrer" aria-label={`Share via ${destination.label}`} onClick={() => setOpen(false)}>
            <BrandIcon size={20} aria-hidden="true" /><span>{destination.label}</span>
          </a>;
        })}
      </div>
      <button type="button" className="job-share-copy" onClick={() => void copyLink()}><Link2 size={16} />Copy link</button>
      {copyStatus && <span className="job-share-copy-status" aria-live="polite">{copyStatus}</span>}
    </div>}
  </div>;
}
