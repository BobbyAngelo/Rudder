import { NextResponse } from "next/server";
import { exec } from "child_process";
import { join } from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    const cliDir = join(process.cwd(), "..", "cli");
    
    // Trigger the sync command (fire and forget)
    // We execute it in the background so the UI doesn't block for minutes if there's a lot of data.
    execPromise('npm run rudder -- sync', { cwd: cliDir }).catch(err => {
      console.error("Sync error:", err);
    });

    return NextResponse.json({ success: true, message: "Sync daemon triggered" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
