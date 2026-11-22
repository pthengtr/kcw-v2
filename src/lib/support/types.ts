import type { SupportTargetMeta, SupportTargetSource } from "./catalog";

export type SupportTicketKind = "bug" | "improvement";
export type SupportTicketStatus =
  | "pending"
  | "running"
  | "waiting"
  | "done"
  | "failed";

export type SupportTicket = {
  id: string;
  created_by: string;
  kind: SupportTicketKind;
  target_source: SupportTargetSource;
  target_id: string;
  target_label: string;
  target_meta: SupportTargetMeta;
  title: string;
  body: string;
  attachment_paths: string[];
  status: SupportTicketStatus;
  agent_session_id: string | null;
  pr_url: string | null;
  merge_sha: string | null;
  error_message: string | null;
  reopen_count: number;
  claimed_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketEvent = {
  id: number;
  ticket_id: string;
  event_type: string;
  actor_id: string | null;
  comment: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  pending: "รอคิว",
  running: "กำลังทำ",
  waiting: "รอตรวจ",
  done: "ปิดแล้ว",
  failed: "ล้มเหลว",
};

export const SUPPORT_BUCKET = "pictures";
export const supportAttachmentFolder = (ticketId: string) =>
  `public/support/${ticketId}`;
