import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import {
  createTimelineMilestone,
  updateTimelineMilestone,
  deleteTimelineMilestone,
} from "@/lib/db/career";

export async function POST(req: NextRequest) {
  try {
    const { company, title, division, startDate, endDate, highlights } = await req.json();

    if (!company || !title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields: company, title, startDate, or endDate" }, { status: 400 });
    }

    const id = createTimelineMilestone({ company, title, division, startDate, endDate, highlights });

    return NextResponse.json({
      success: true,
      id,
      message: "Timeline milestone created successfully"
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, company, title, division, startDate, endDate, highlights } = await req.json();

    if (!id || !company || !title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields: id, company, title, startDate, or endDate" }, { status: 400 });
    }

    const changed = updateTimelineMilestone(id, { company, title, division, startDate, endDate, highlights });

    if (!changed) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Timeline milestone updated successfully"
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
    }

    const changed = deleteTimelineMilestone(Number(id));

    if (!changed) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Timeline milestone deleted successfully"
    });
  } catch (err) {
    return serverError(err);
  }
}
