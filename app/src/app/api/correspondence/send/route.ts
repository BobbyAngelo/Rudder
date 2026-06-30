import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  getSmtpPreferences,
  getIncomingCorrespondence,
  recordSentReply,
} from "@/lib/db/correspondence";
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

    // 1. Fetch user SMTP preferences
    const prefs = getSmtpPreferences();

    if (!prefs || !prefs.smtp_host || !prefs.smtp_user || !prefs.smtp_pass) {
      return NextResponse.json({ error: "SMTP host or credentials not configured in Settings -> Integrations." }, { status: 400 });
    }

    // 2. Fetch target incoming correspondence record
    const msg = getIncomingCorrespondence(correspondenceId);

    if (!msg) {
      return NextResponse.json({ error: `Incoming correspondence message not found with ID: ${correspondenceId}` }, { status: 404 });
    }

    const replySubject = msg.subject && msg.subject.toLowerCase().startsWith("re:") 
      ? msg.subject 
      : `Re: ${msg.subject || "Your message"}`;

    log.info(`[smtp-route] Sending email to ${msg.sender} via ${prefs.smtp_host}:${prefs.smtp_port || 587}...`);

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
    recordSentReply({
      fromUser: prefs.smtp_user,
      toRecipient: msg.sender,
      subject: replySubject,
      body: replyBody,
      messageId: sentMessageId,
      incomingId: correspondenceId,
    });

    log.info(`[smtp-route] ✅ Email sent successfully to ${msg.sender}. Info ID: ${sentMessageId}`);

    return NextResponse.json({ 
      success: true, 
      message: "Email sent successfully",
      messageId: sentMessageId 
    });

  } catch (error) {
    log.error("POST /api/correspondence/send Error:", error);
    return serverError(error);
  }
}
