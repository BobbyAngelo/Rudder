import chalk from "chalk";
import { openRudderDB } from "../utils/db.js";
import { log } from "../utils/logger.js";

function cleanSearchQuery(q: string): string {
  const clean = q.replace(/["'\\\/*:|~+<>]/g, " ").trim();
  const terms = clean.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map(term => `"${term}"*`).join(" AND ");
}

export async function searchCommand(query: string, options: { port?: string }) {
  const port = options.port || "3000";
  const trimmedQuery = query.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    log.error("Search query must be at least 2 characters.");
    return;
  }

  log.info(`Searching for: "${chalk.bold(trimmedQuery)}"...`);
  log.br();

  // 1. Attempt API search
  let success = false;
  try {
    const res = await fetch(`http://localhost:${port}/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
      headers: { "Accept": "application/json" }
    });

    if (res.ok) {
      const data = await res.json() as any;
      success = true;
      displayResults(data.results || []);
    }
  } catch (err) {
    log.warn(`API search failed on port ${port}. Falling back to direct database search.`);
  }

  // 2. Fallback direct DB search
  if (!success) {
    try {
      const db = openRudderDB();
      const cleanQ = cleanSearchQuery(trimmedQuery);

      if (!cleanQ) {
        log.warn("Invalid search query after filtering.");
        db.close();
        return;
      }

      // Check if search_index table exists
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'").get();
      if (!tableExists) {
        log.error("Search index table not found. Please start Rudder web app to initialize migrations.");
        db.close();
        return;
      }

      const rows = db.prepare(`
        SELECT origin_id, origin_table, title, content, tags, rank
        FROM search_index 
        WHERE search_index MATCH ? 
        ORDER BY rank 
        LIMIT 20
      `).all(cleanQ) as any[];

      const results = rows.map(row => {
        let type = row.origin_table;
        let subtitle = row.content || "";

        // Clean HTML tags and markdown markers
        subtitle = subtitle.replace(/[#*`_\[\]]/g, "").trim();

        // Normalize labels
        if (type === "journal_entries") {
          type = "writing";
          subtitle = `Journal · ${subtitle.slice(0, 70)}...`;
        } else if (type === "tasks") {
          type = "task";
          subtitle = `Task · ${subtitle.slice(0, 70) || "Action Item"}`;
        } else if (type === "calendar_events") {
          type = "event";
          subtitle = `Calendar Event · ${subtitle.slice(0, 70)}`;
        } else if (type === "people") {
          type = "contact";
          subtitle = subtitle.slice(0, 70);
        } else if (type === "wiki") {
          type = "wiki";
          subtitle = `Wiki · ${subtitle.slice(0, 70)}...`;
        } else {
          subtitle = subtitle.slice(0, 70);
        }

        return {
          title: row.title,
          subtitle,
          type
        };
      });

      displayResults(results);
      db.close();
    } catch (dbErr: any) {
      log.error(`Database search failed: ${dbErr.message}`);
    }
  }
}

function displayResults(results: { title: string; subtitle: string; type: string }[]) {
  if (results.length === 0) {
    log.info("No matching records found.");
    return;
  }

  console.log(chalk.bold.underline(`Search Results (${results.length}):`));
  console.log("");

  // Group by category/type for beautiful presentation
  const grouped: Record<string, typeof results> = {};
  for (const item of results) {
    const type = item.type.toUpperCase();
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(item);
  }

  for (const [type, items] of Object.entries(grouped)) {
    let typeColor = chalk.white.bgBlue;
    if (type === "TASK") typeColor = chalk.black.bgYellow;
    if (type === "EVENT") typeColor = chalk.black.bgMagenta;
    if (type === "WRITING") typeColor = chalk.black.bgGreen;
    if (type === "WIKI") typeColor = chalk.black.bgCyan;

    console.log(` ${typeColor(` ${type} `)}`);
    for (const item of items) {
      console.log(`   ${chalk.bold(item.title)}`);
      if (item.subtitle) {
        console.log(`     ${chalk.dim(item.subtitle)}`);
      }
    }
    console.log("");
  }
}
