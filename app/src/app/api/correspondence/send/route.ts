import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../../lib/db";
import * as nodemailer from "nodemailer";

/* ═══════════════════════════════════════════════════════
   SMTP Mail Sender API Route
   Sends draft auto-replies via local SMTP settings.
   ═══════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const { correspondenceId, replyBody } = await req.json();

    if (!correspondenceId || !replyBody) {
      return NextResponse.json({ error: "Missing correspondenceId or replyBody" }, { status: 400 });
    }

    const db = getDB();

    // 1. Fetch user SMTP preferences
    const prefs = db.prepare(`
      SELECT smtp_host, smtp_port, smtp_user, smtp_pass, display_name 
      FROM user_preferences up
      LEFT JOIN identity_profile ip ON ip.id = 1
      WHERE up.id = 1
    `).get() as any;

    if (!prefs || !prefs.smtp_host || !prefs.smtp_user || !prefs.smtp_pass) {
      return NextResponse.json({ error: "SMTP host or credentials not configured in Settings -> Integrations." }, { status: 400 });
    }

    // 2. Fetch target incoming correspondence record
    const msg = db.prepare(`
      SELECT sender, recipient, subject, body 
      FROM correspondence 
      WHERE id = ? AND direction = 'incoming'
    `).get(correspondenceId) as any;

    if (!msg) {
      return NextResponse.json({ error: `Incoming correspondence message not found with ID: ${correspondenceId}` }, { status: 404 });
    }

    const replySubject = msg.subject && msg.subject.toLowerCase().startsWith("re:") 
      ? msg.subject 
      : `Re: ${msg.subject || "Your message"}`;

    console.log(`[smtp-route] Sending email to ${msg.sender} via ${prefs.smtp_host}:${prefs.smtp_port || 587}...`);

    // 3. Create SMTP Transport
    const transporter = nodemailer.createTransport({
      host: prefs.smtp_host,
      port: prefs.smtp_port || 587,
      secure: prefs.smtp_port === 465, // True for port 465, false for 587
      auth: {
        user: prefs.smtp_user,
        pass: prefs.smtp_pass,
      },
    });

    // 4. Send the mail envelope
    const info = await transporter.sendMail({
      from: `"${prefs.display_name || "Rudder User"}" <${prefs.smtp_user}>`,
      to: msg.sender,
      subject: replySubject,
      text: replyBody,
    });

    const sentMessageId = info.messageId || `smtp_${Date.now()}@rudder.local`;

    // 5. Update SQLite database (transactional)
    db.transaction(() => {
      // Create outgoing correspondence record
      db.prepare(`
        INSERT INTO correspondence (sender, recipient, subject, body, platform, direction, message_id)
        VALUES (?, ?, ?, ?, 'email', 'outgoing', ?)
      `).run(prefs.smtp_user, msg.sender, replySubject, replyBody, sentMessageId);

      // Update incoming correspondence decision log state
      db.prepare(`
        UPDATE correspondence 
        SET decision_log = ? 
        WHERE id = ?
      `).run(`[Replied] Sent via SMTP. Message ID: ${sentMessageId}`, correspondenceId);
    })();

    console.log(`[smtp-route] ✅ Email sent successfully to ${msg.sender}. Info ID: ${sentMessageId}`);

    return NextResponse.json({ 
      success: true, 
      message: "Email sent successfully",
      messageId: sentMessageId 
    });

  } catch (error: any) {
    console.error("POST /api/correspondence/send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
