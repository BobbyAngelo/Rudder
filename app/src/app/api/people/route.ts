import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   /api/people — Contacts CRUD
   
   GET  → Returns paginated contacts with optional search
   POST → Creates a new contact
   ═══════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const relationship = searchParams.get("relationship") || "";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = "SELECT * FROM people WHERE 1=1";
    const params: any[] = [];

    if (search) {
      query += " AND (name LIKE ? OR email LIKE ? OR company LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (relationship) {
      query += " AND relationship = ?";
      params.push(relationship);
    }

    // Get total count
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const { total } = db.prepare(countQuery).get(...params) as any;

    // Get relationship breakdown
    const relationships = db
      .prepare("SELECT relationship, COUNT(*) as count FROM people GROUP BY relationship ORDER BY count DESC")
      .all();

    // Get paginated results
    query += " ORDER BY warmth DESC, name ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const people = db.prepare(query).all(...params);

    return NextResponse.json({ people, total, relationships });
  } catch (error: any) {
    console.error("[api/people] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();

    const result = db
      .prepare(
        `INSERT INTO people (name, email, phone, company, role, relationship, notes, warmth, linkedin, website, address)
         VALUES (@name, @email, @phone, @company, @role, @relationship, @notes, @warmth, @linkedin, @website, @address)`
      )
      .run({
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        company: body.company || null,
        role: body.role || null,
        relationship: body.relationship || "contact",
        notes: body.notes || "",
        warmth: body.warmth !== undefined ? body.warmth : 10,
        linkedin: body.linkedin || null,
        website: body.website || null,
        address: body.address || null,
      });

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    console.error("[api/people] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();
    const { id, name, email, phone, company, role, relationship, notes, warmth, linkedin, website, address } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing contact ID" }, { status: 400 });
    }

    db.prepare(`
      UPDATE people
      SET name = @name,
          email = @email,
          phone = @phone,
          company = @company,
          role = @role,
          relationship = @relationship,
          notes = @notes,
          warmth = @warmth,
          linkedin = @linkedin,
          website = @website,
          address = @address,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      role: role || null,
      relationship: relationship || "contact",
      notes: notes || "",
      warmth: warmth !== undefined ? warmth : 0,
      linkedin: linkedin || null,
      website: website || null,
      address: address || null,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/people] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing contact ID" }, { status: 400 });
    }

    db.prepare("DELETE FROM people WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/people] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
