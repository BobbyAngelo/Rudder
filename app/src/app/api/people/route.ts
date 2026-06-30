import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  listPeople,
  relationshipBreakdown,
  createPerson,
  updatePerson,
  deletePerson,
  type PersonInput,
} from "@/lib/db/people";

/* ═══════════════════════════════════════════════════════
   /api/people — Contacts CRUD

   GET  → Returns paginated contacts with optional search
   POST → Creates a new contact
   PUT  → Updates an existing contact
   DELETE → Removes a contact
   ═══════════════════════════════════════════════════════ */

type PersonBody = Partial<PersonInput> & { id?: number };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { people, total } = listPeople({
      search: searchParams.get("q") || undefined,
      relationship: searchParams.get("relationship") || undefined,
      limit: parseInt(searchParams.get("limit") || "100"),
      offset: parseInt(searchParams.get("offset") || "0"),
    });
    const relationships = relationshipBreakdown();

    return NextResponse.json({ people, total, relationships });
  } catch (error) {
    log.error("[api/people] GET error:", error);
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PersonBody;
    if (!body.name) {
      return NextResponse.json({ error: "Missing contact name" }, { status: 400 });
    }
    const id = createPerson(body as PersonInput);
    return NextResponse.json({ id });
  } catch (error) {
    log.error("[api/people] POST error:", error);
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as PersonBody;
    if (!body.id) {
      return NextResponse.json({ error: "Missing contact ID" }, { status: 400 });
    }
    if (!body.name) {
      return NextResponse.json({ error: "Missing contact name" }, { status: 400 });
    }
    updatePerson(body.id, body as PersonInput);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/people] PUT error:", error);
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "");
    if (!id) {
      return NextResponse.json({ error: "Missing contact ID" }, { status: 400 });
    }
    deletePerson(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/people] DELETE error:", error);
    return serverError(error);
  }
}
