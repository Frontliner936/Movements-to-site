import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Inbox, Mail, MailOpen, RefreshCw } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type VisitorMessage = { id: number; email: string; message: string; isRead: boolean; createdAt: string; readAt: string | null };
type InboxResponse = { messages: VisitorMessage[]; unreadMessages: number };

export default function AdminMessages({ onChanged }: { onChanged: () => void }) {
  const [messages, setMessages] = useState<VisitorMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<InboxResponse>("/api/gm/admin/messages");
      setMessages(result.messages);
      setUnread(result.unreadMessages);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setError("Your admin session has expired. Sign in again to view messages.");
      else setError(reason instanceof Error ? reason.message : "The inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function setRead(message: VisitorMessage) {
    setBusyId(message.id);
    setError("");
    try {
      await api(`/api/gm/admin/messages/${message.id}/read`, { method: "PATCH", body: JSON.stringify({ isRead: !message.isRead }) });
      await refresh();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message status could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  return <section className="admin-messages-page">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">PRIVATE ADMIN INBOX</span><h1>Visitor messages</h1><p>Read notes sent through the public Get Mchongo contact form.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} /> Refresh</button></div>
    {error && <p className="admin-alert error-alert" role="alert">{error}</p>}
    <div className="admin-panel messages-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">INBOX</span><h2>{unread} unread</h2></div><span className="messages-private-note"><Inbox size={14} /> Visible only to administrators</span></div>
      {loading ? <div className="panel-empty"><span className="loading-dot" />Loading messages…</div> : messages.length === 0 ? <div className="panel-empty"><Mail size={20} /><p>No visitor messages yet.</p></div> : <div className="visitor-message-list">
        {messages.map(item => <article key={item.id} className={`visitor-message-card ${item.isRead ? "" : "visitor-message-unread"}`}>
          <div className="visitor-message-top"><span className={`message-state ${item.isRead ? "message-state-read" : ""}`}>{item.isRead ? <><MailOpen size={12} /> Read</> : <><Mail size={12} /> New</>}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
          <a className="visitor-message-email" href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Get Mchongo — your message")}`}>{item.email}</a>
          <p className="visitor-message-body">{item.message}</p>
          <div className="visitor-message-actions"><a className="subtle-link" href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Get Mchongo — your message")}`}>Reply by email <Mail size={13} /></a><button type="button" className="text-link" onClick={() => void setRead(item)} disabled={busyId === item.id}>{item.isRead ? "Mark unread" : "Mark read"} <CheckCheck size={13} /></button></div>
        </article>)}
      </div>}
      <p className="messages-limit-note">The inbox shows the newest 500 messages. Visitor emails and message text are not displayed on public pages.</p>
    </div>
  </section>;
}
