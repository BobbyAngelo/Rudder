import { NextRequest, NextResponse } from "next/server";
import { executeNCIReflection, NCILensType } from "@/lib/ai";
import { NCIBiometricState } from "@/lib/nci_factory";

/**
 * API Route: /api/nci
 * Orchestrates Neuro-Cognitive Influence (NCI) reflections based on biometric signals.
 *
 * Non-negotiable: Standard hyphens, colons, or parentheses only. Zero em-dashes.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lens, state, mode } = body as {
      lens: NCILensType;
      state: NCIBiometricState;
      mode?: string;
    };

    if (!lens || !state) {
      return NextResponse.json(
        { error: "Missing required parameters: 'lens' and 'state' must be provided." },
        { status: 400 }
      );
    }

    // Call the NCI execution engine
    const insight = await executeNCIReflection(lens, state, mode || "local_ollama");

    return NextResponse.json({
      success: true,
      lens,
      insight
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during NCI processing." },
      { status: 500 }
    );
  }
}
