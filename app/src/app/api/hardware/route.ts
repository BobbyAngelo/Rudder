import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_PATH = join(process.cwd(), "..", "data", "business", "hardware-registry.json");

export async function GET() {
  try {
    if (!existsSync(DATA_PATH)) {
      return NextResponse.json({ cluster: [], projects: [], parts: [] });
    }
    const data = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
