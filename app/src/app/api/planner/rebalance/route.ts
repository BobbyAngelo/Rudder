import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../../lib/db";

/* ═══════════════════════════════════════════════════════
   Autonomic Rebalancer API Route
   Serves task rescheduling proposals and handles approvals.
   ═══════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Fetch latest fatigue health metrics
    const health = db.prepare(`
      SELECT sleep_hours, hrv 
      FROM health_metrics 
      ORDER BY date DESC 
      LIMIT 1
    `).get() as any;

    // 2. Fetch pending proposals for today
    const proposals = db.prepare(`
      SELECT p.*, t.title as task_title, t.description as task_description
      FROM rebalance_proposals p
      JOIN tasks t ON t.id = p.task_id
      WHERE p.status = 'pending' AND p.date = ?
    `).all(todayStr) as any[];

    return NextResponse.json({
      success: true,
      proposals,
      health: health ? { sleep_hours: health.sleep_hours, hrv: health.hrv } : null
    });
  } catch (error: any) {
    console.error("GET /api/planner/rebalance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, proposalIds } = await req.json();

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
    }

    const db = getDB();
    const todayStr = new Date().toISOString().split("T")[0];

    // If no specific IDs provided, get all pending proposals for today
    let targetIds = proposalIds;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      const pending = db.prepare(`
        SELECT id FROM rebalance_proposals 
        WHERE status = 'pending' AND date = ?
      `).all(todayStr) as any[];
      targetIds = pending.map(p => p.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, message: "No pending proposals to process." });
    }

    // Process rebalancing in a SQLite transaction
    db.transaction(() => {
      for (const id of targetIds) {
        const prop = db.prepare("SELECT * FROM rebalance_proposals WHERE id = ?").get(id) as any;
        if (!prop) continue;

        if (action === 'approve') {
          // Update the task due date to proposed rescheduled date
          db.prepare("UPDATE tasks SET due_date = ?, updated_at = (datetime('now')) WHERE id = ?")
            .run(prop.proposed_date, prop.task_id);

          // Update proposal status
          db.prepare("UPDATE rebalance_proposals SET status = 'approved' WHERE id = ?").run(id);
        } else {
          // Just update proposal status to rejected
          db.prepare("UPDATE rebalance_proposals SET status = 'rejected' WHERE id = ?").run(id);
        }
      }
    })();

    console.log(`[rebalance-route] Processed ${targetIds.length} proposals: action=${action}`);

    return NextResponse.json({
      success: true,
      message: `Successfully ${action === 'approve' ? 'approved and rescheduled' : 'ignored'} ${targetIds.length} task proposals.`
    });

  } catch (error: any) {
    console.error("POST /api/planner/rebalance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
