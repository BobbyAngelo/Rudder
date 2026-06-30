import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import {
  listDataSources,
  listMcpServers,
  getExecutionSettings,
  listTelemetryDevices,
  createDataSource,
  createMcpServer,
  updateExecutionSettings,
  deleteIntegrationRow,
  isDeletableIntegrationTable,
  type ExecutionSettingsUpdateInput,
} from "@/lib/db/settings";

interface IntegrationsPostBody {
  type?: string;
  name?: string;
  path?: string;
  source_type?: string;
  command?: string;
  args?: unknown;
  env?: unknown;
}

export async function GET() {
  try {
    // Get MCP Servers (parse JSON columns for the response)
    const mcpServers = listMcpServers().map((s) => ({
      ...s,
      args: JSON.parse(s.args || "[]"),
      env: JSON.parse(s.env || "{}"),
    }));

    return NextResponse.json({
      data_sources: listDataSources(),
      mcp_servers: mcpServers,
      execution: getExecutionSettings(),
      devices: listTelemetryDevices(),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IntegrationsPostBody;

    if (body.type === "data_source") {
      const id = createDataSource({
        name: body.name ?? "",
        path: body.path ?? "",
        source_type: body.source_type,
      });
      return NextResponse.json({ success: true, id });
    }

    if (body.type === "mcp_server") {
      const id = createMcpServer({
        name: body.name ?? "",
        command: body.command ?? "",
        args: body.args,
        env: body.env,
      });
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as ExecutionSettingsUpdateInput;

    // Update execution and email preferences. Only patches fields that are
    // present; if nothing was updatable, report "Nothing to update".
    const updated = updateExecutionSettings(body);
    if (updated) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const table = searchParams.get("table"); // "data_sources" or "mcp_servers"

    if (!id || !isDeletableIntegrationTable(table)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    deleteIntegrationRow(table, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
