import React, { useEffect, useId, useRef, useState } from "react";
import { Link2, Share2 } from "lucide-react";
import type { IconType } from "react-icons";
import { FaFacebookF, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { createJobShareInfo, type ShareableJob, type SocialDestination } from "@/lib/jobSharing";

type Props = {
  job: ShareableJob;
  variant?: "icon" | "button";
  onStatus?: (message: string) => void;
};

const brandIcons: Record<SocialDestination["id"], IconType> = {
  whatsapp: FaWhatsapp,
  facebook: FaFacebookF,
  x: FaXTwitter,
  linkedin: FaLinkedinIn,
  telegram: FaTelegram,
};

export function JobQuickShareButtons({ job, variant = "icon" }: { job: ShareableJob; variant?: "icon" | "button" }) {
  const canonicalHref = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const shareInfo = createJobShareInfo(job, window.location.origin, canonicalHref);
  const destinations = shareInfo.destinations.filter(destination => destination.id === "whatsapp" || destination.id === "linkedin");
  return <div className={`job-quick-share-buttons job-quick-share-${variant}`} role="group" aria-label="Share directly">
    {destinations.map(destination => {
      const BrandIcon = brandIcons[destination.id];
      return <a
        key={destination.id}
        className={variant === "button" ? `secondary-button job-quick-share-button job-share-${destination.id}` : `icon-button job-quick-share-icon job-share-${destination.id}`}
        href={destination.href}
        target="_blank"
        rel="noopener noreferrer"
        title={`Share on ${destination.label}`}
        aria-label={`Share job on ${destination.label}`}
      ><BrandIcon size={variant === "button" ? 15 : 17} aria-hidden="true" />{variant === "button" && <span>{destination.label}</span>}</a>;
    })}
  </div>;
}

export function JobShareMenu({ job, variant = "icon", onStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const controlRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const canonicalHref = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const shareInfo = createJobShareInfo(job, window.location.origin, canonicalHref);

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
      onStatus?.("Link copied to clipboard.");
    } catch {
      setCopyStatus("Could not copy the link.");
      onStatus?.("Could not copy the link.");
    }
  }

  return <div className={`job-share-control job-share-${variant}`} ref={controlRef} data-open={open}>
    <button
      type="button"
      className={variant === "button" ? "secondary-button job-share-trigger" : "icon-button job-share-trigger"}
      aria-label="Share job"
      aria-expanded={open}
      aria-controls={menuId}
      aria-haspopup="true"
      onClick={() => { setOpen(value => !value); setCopyStatus(""); }}
    >
      <Share2 size={variant === "button" ? 15 : 16} />{variant === "button" && <span>Share</span>}
    </button>
    {open && <div className="job-share-popover" id={menuId} role="region" aria-label={`Share ${job.title}`}>
      <strong className="job-share-heading">Share this opportunity</strong>
      <div className="job-share-social-grid" role="group" aria-label="Social media platforms">
        {shareInfo.destinations.map(destination => {
          const BrandIcon = brandIcons[destination.id];
          return <a
            key={destination.id}
            className={`job-share-social-link job-share-${destination.id}`}
            href={destination.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share via ${destination.label}`}
            onClick={() => setOpen(false)}
          ><BrandIcon size={20} aria-hidden="true" /><span>{destination.label}</span></a>;
        })}
      </div>
      <button type="button" className="job-share-copy" onClick={() => void copyLink()}><Link2 size={16} />Copy link</button>
      {copyStatus && <span className="job-share-copy-status" aria-live="polite">{copyStatus}</span>}
    </div>}
  </div>;
}
