import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  getProfile,
  listValues,
  listMilestones,
  listLinks,
  updateProfile,
  clearValues,
  insertValue,
  clearMilestones,
  insertMilestone,
  clearLinks,
  insertLink,
  type IdentityProfileUpdateInput,
  type IdentityValueInput,
  type IdentityMilestoneInput,
  type IdentityLinkInput,
} from "@/lib/db/identity";

/* ═══════════════════════════════════════════════════════
   /api/identity — Profile CRUD

   GET  → Returns the profile + values + milestones + links
   PUT  → Updates the profile fields
   ═══════════════════════════════════════════════════════ */

interface IdentityPutBody {
  profile?: IdentityProfileUpdateInput;
  values?: IdentityValueInput[];
  replaceValues?: boolean;
  milestones?: IdentityMilestoneInput[];
  replaceMilestones?: boolean;
  links?: IdentityLinkInput[];
  replaceLinks?: boolean;
}

export async function GET() {
  try {
    return NextResponse.json({
      profile: getProfile(),
      values: listValues(),
      milestones: listMilestones(),
      links: listLinks(),
    });
  } catch (error) {
    log.error("[api/identity] GET error:", error);
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as IdentityPutBody;

    // Update profile fields
    if (body.profile) {
      updateProfile(body.profile);
    }

    // Upsert values
    if (body.values) {
      // If full replacement, clear first
      if (body.replaceValues) {
        clearValues();
      }
      for (const v of body.values) {
        insertValue(v);
      }
    }

    // Add milestones
    if (body.milestones) {
      if (body.replaceMilestones) {
        clearMilestones();
      }
      for (const m of body.milestones) {
        insertMilestone(m);
      }
    }

    // Add links
    if (body.links) {
      if (body.replaceLinks) {
        clearLinks();
      }
      for (const l of body.links) {
        insertLink(l);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/identity] PUT error:", error);
    return serverError(error);
  }
}
