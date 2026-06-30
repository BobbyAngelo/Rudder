/* ═══════════════════════════════════════════════════════
   Correspondence repository — typed data access for the
   `correspondence` table (inbox + action ledger).

   Centralizes all correspondence SQL so the API routes don't build queries
   inline. AI-drafting and SMTP-sending logic stays in the routes; this module
   owns only the database access. All inputs are passed as bound parameters and
   column lists are fixed string literals, never interpolated from user input.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

type SqlParam = string | number | bigint | null;

/** A row of the `correspondence` table (migration 027, message_id from 033). */
export interface CorrespondenceRow {
  id: number;
  sender: string;
  recipient: string;
  subject: string | null;
  body: string;
  platform: string;
  direction: string;
  decision_log: string | null;
  message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrespondenceListFilter {
  platform?: string | null;
  direction?: string | null;
  limit?: number;
}

export interface CorrespondenceCreateInput {
  sender: string;
  recipient: string;
  subject?: string | null;
  body: string;
  platform: string;
  direction: string;
  decision_log?: string | null;
  message_id?: string | null;
  created_at?: string | null;
}

/** SMTP + identity preferences needed to send a reply. */
export interface SmtpPreferences {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  display_name: string | null;
}

/** List correspondence (newest first), optionally filtered by platform/direction. */
export function listCorrespondence(
  filter: CorrespondenceListFilter = {},
): CorrespondenceRow[] {
  const params: SqlParam[] = [];
  const conditions: string[] = [];

  if (filter.platform) {
    conditions.push("platform = ?");
    params.push(filter.platform);
  }
  if (filter.direction) {
    conditions.push("direction = ?");
    params.push(filter.direction);
  }

  let query = "SELECT * FROM correspondence";
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(filter.limit ?? 20);

  return getDB().prepare(query).all(...params) as CorrespondenceRow[];
}

/** Fetch a single correspondence row by id. */
export function getCorrespondence(id: number): CorrespondenceRow | undefined {
  return getDB()
    .prepare("SELECT * FROM correspondence WHERE id = ?")
    .get(id) as CorrespondenceRow | undefined;
}

/** Fetch an incoming correspondence row by id (for replies). */
export function getIncomingCorrespondence(
  id: number,
): CorrespondenceRow | undefined {
  return getDB()
    .prepare("SELECT * FROM correspondence WHERE id = ? AND direction = 'incoming'")
    .get(id) as CorrespondenceRow | undefined;
}

/** Insert a new correspondence row; returns the inserted row. */
export function createCorrespondence(
  input: CorrespondenceCreateInput,
): CorrespondenceRow {
  const result = getDB()
    .prepare(
      `INSERT INTO correspondence (sender, recipient, subject, body, platform, direction, decision_log, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sender,
      input.recipient,
      input.subject ?? null,
      input.body,
      input.platform,
      input.direction,
      input.decision_log ?? null,
      input.created_at || new Date().toISOString(),
    );
  // Row is guaranteed to exist immediately after a successful insert.
  return getCorrespondence(Number(result.lastInsertRowid))!;
}

/** Fetch the SMTP/identity preferences (singleton row id = 1). */
export function getSmtpPreferences(): SmtpPreferences | undefined {
  return getDB()
    .prepare(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, display_name
       FROM user_preferences up
       LEFT JOIN identity_profile ip ON ip.id = 1
       WHERE up.id = 1`,
    )
    .get() as SmtpPreferences | undefined;
}

/**
 * Record a sent reply transactionally: insert the outgoing message and stamp
 * the incoming row's decision_log with the SMTP send status.
 */
export function recordSentReply(input: {
  fromUser: string;
  toRecipient: string;
  subject: string;
  body: string;
  messageId: string;
  incomingId: number;
}): void {
  const db = getDB();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO correspondence (sender, recipient, subject, body, platform, direction, message_id)
       VALUES (?, ?, ?, ?, 'email', 'outgoing', ?)`,
    ).run(
      input.fromUser,
      input.toRecipient,
      input.subject,
      input.body,
      input.messageId,
    );

    db.prepare("UPDATE correspondence SET decision_log = ? WHERE id = ?").run(
      `[Replied] Sent via SMTP. Message ID: ${input.messageId}`,
      input.incomingId,
    );
  })();
}
