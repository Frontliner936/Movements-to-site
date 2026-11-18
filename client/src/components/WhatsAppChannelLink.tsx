import { FaWhatsapp } from "react-icons/fa6";
import { recordWhatsAppChannelClick } from "@/lib/api";

export const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb6lza03wtb62igZVt0V";

export function WhatsAppChannelLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={`whatsapp-channel-link ${className}`.trim()}
      href={WHATSAPP_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join our WhatsApp channel"
      onClick={recordWhatsAppChannelClick}
    >
      <FaWhatsapp size={16} aria-hidden="true" />
      <span>Join channel</span>
    </a>
  );
}
