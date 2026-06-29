import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/* ═══════════════════════════════════════════════════════
   Rudder Database — Core Module
   
   Single SQLite database with WAL mode.
   Each section defines its own tables via migration functions.
   
   Usage:
     import { getDB } from "@/lib/db";
     const db = getDB();
     const rows = db.prepare("SELECT * FROM identity_profile").all();
   ═══════════════════════════════════════════════════════ */

const DB_DIR = path.join(process.cwd(), "..", "data");
const DB_FILE = path.join(DB_DIR, "rudder.db");

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_FILE);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Run all migrations
  runMigrations(_db);

  return _db;
}

/* ═══════════════════════════════════════════════════════
   Migrations
   ═══════════════════════════════════════════════════════ */

function runMigrations(db: Database.Database) {
  // Create migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((r: any) => r.name)
  );

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      try {
        db.exec(migration.sql);
        db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(migration.name);
        console.log(`[db] Applied migration: ${migration.name}`);
      } catch (error: any) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("duplicate column name") || 
          msg.includes("already exists") || 
          msg.includes("duplicate column")
        ) {
          console.warn(`[db] Migration ${migration.name} warning (already applied manually):`, error.message);
          db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(migration.name);
        } else {
          console.error(`[db] Migration ${migration.name} failed:`, error.message);
          throw error;
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════
   Migration Definitions
   
   Add new migrations to the end of this array.
   Never modify existing migrations — add new ones.
   ═══════════════════════════════════════════════════════ */

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: "001_identity",
    sql: `
      -- ── Identity: Core Profile ──
      CREATE TABLE IF NOT EXISTS identity_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton row
        display_name TEXT NOT NULL DEFAULT '',
        full_name TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        timezone TEXT NOT NULL DEFAULT '',
        date_of_birth TEXT,                      -- ISO date
        avatar_url TEXT,
        website TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Initialize the singleton profile row
      INSERT OR IGNORE INTO identity_profile (id) VALUES (1);

      -- ── Identity: Values ──
      CREATE TABLE IF NOT EXISTS identity_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 0,     -- Sort order
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Identity: Milestones ──
      CREATE TABLE IF NOT EXISTS identity_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        date TEXT,                               -- ISO date
        category TEXT NOT NULL DEFAULT 'life',   -- life, career, education, personal
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Identity: Links / Social ──
      CREATE TABLE IF NOT EXISTS identity_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,                  -- github, linkedin, twitter, etc.
        url TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: "002_journal",
    sql: `
      -- ── Writing: Journal Entries ──
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'journal',    -- journal, sprint, biographer
        word_count INTEGER NOT NULL DEFAULT 0,
        wpm INTEGER,                            -- Words per minute (sprint mode)
        tags TEXT NOT NULL DEFAULT '[]',         -- JSON array
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_journal_mode ON journal_entries(mode);
    `,
  },
  {
    name: "003_hardware",
    sql: `
      -- ── Hardware: Projects ──
      CREATE TABLE IF NOT EXISTS hardware_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'research', -- research, development, production, archived
        description TEXT NOT NULL DEFAULT '',
        specs TEXT NOT NULL DEFAULT '[]',         -- JSON array of spec strings
        repo_path TEXT,                          -- Local repo path
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_hardware_status ON hardware_projects(status);
    `,
  },
  {
    name: "004_people",
    sql: `
      -- ── People: Contacts ──
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        role TEXT,                               -- Their role/title
        relationship TEXT NOT NULL DEFAULT '',    -- friend, colleague, family, client, etc.
        notes TEXT NOT NULL DEFAULT '',
        last_contact TEXT,                        -- ISO date of last interaction
        warmth REAL DEFAULT 0.5,                  -- contact warmth index (0.0 to 1.0)
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
      CREATE INDEX IF NOT EXISTS idx_people_relationship ON people(relationship);
    `,
  },
  {
    name: "005_health",
    sql: `
      -- ── Health: Daily Metrics ──
      CREATE TABLE IF NOT EXISTS health_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,               -- ISO date (one row per day)
        sleep_hours REAL,
        resting_hr INTEGER,
        hrv INTEGER,
        steps INTEGER,
        weight REAL,
        mood INTEGER,                            -- 1-10
        energy INTEGER,                          -- 1-10
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_health_date ON health_metrics(date);
    `,
  },
  {
    name: "006_ledger",
    sql: `
      -- ── 10D Reality Ledger (universal event log) ──
      CREATE TABLE IF NOT EXISTS reality_nodes (
        event_id TEXT PRIMARY KEY,
        when_timestamp TEXT NOT NULL,
        where_context TEXT,
        who_entities TEXT DEFAULT '[]',           -- JSON array
        what_classification TEXT NOT NULL,
        why_insight TEXT,
        how_actions TEXT DEFAULT '[]',            -- JSON array
        state_vitals TEXT DEFAULT '{}',           -- JSON object
        gravity_score INTEGER DEFAULT 1,          -- 1-10 impact
        origin_provenance TEXT NOT NULL,           -- Source system
        artifact_id TEXT,
        raw_blob TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_when ON reality_nodes(when_timestamp);
      CREATE INDEX IF NOT EXISTS idx_ledger_what ON reality_nodes(what_classification);
      CREATE INDEX IF NOT EXISTS idx_ledger_gravity ON reality_nodes(gravity_score);
    `,
  },
  {
    name: "007_health_records",
    sql: `
      -- ── Health: Granular Records (from HealthKit) ──
      CREATE TABLE IF NOT EXISTS health_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,                        -- e.g. StepCount, HeartRate, SleepAnalysis
        value REAL,                                -- Numeric value (null for category types)
        unit TEXT,                                 -- e.g. count, count/min, hr
        category_value TEXT,                       -- For category types like sleep stages
        source TEXT NOT NULL DEFAULT '',            -- Source app/device name
        start_date TEXT NOT NULL,                   -- ISO datetime
        end_date TEXT NOT NULL,                     -- ISO datetime
        date TEXT NOT NULL,                         -- ISO date (for daily grouping)
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(type);
      CREATE INDEX IF NOT EXISTS idx_health_records_date ON health_records(date);
      CREATE INDEX IF NOT EXISTS idx_health_records_type_date ON health_records(type, date);
    `,
  },
  {
    name: "008_health_providers",
    sql: `
      -- ── Health: Providers (doctors, appointments, facilities) ──
      CREATE TABLE IF NOT EXISTS health_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL DEFAULT '',         -- e.g. Primary Care, Dentist, Optometrist
        phone TEXT,
        address TEXT,
        website TEXT,
        portal_url TEXT,                            -- Patient portal link
        notes TEXT NOT NULL DEFAULT '',
        next_appointment TEXT,                      -- ISO datetime
        last_visit TEXT,                            -- ISO datetime
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: "009_preferences",
    sql: `
      -- ── User Preferences (singleton — single-user system) ──
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        theme TEXT NOT NULL DEFAULT 'dark',
        accent_color TEXT NOT NULL DEFAULT '#34d399',
        font_family TEXT NOT NULL DEFAULT 'Inter',
        font_scale REAL NOT NULL DEFAULT 1.0,
        border_radius REAL NOT NULL DEFAULT 1.0,
        sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
        enabled_modules TEXT NOT NULL DEFAULT '["identity","writing"]',
        dashboard_layout TEXT NOT NULL DEFAULT 'default',
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        tts_provider TEXT NOT NULL DEFAULT 'native',
        tts_endpoint TEXT,
        tts_ref_audio TEXT,
        tts_ref_text TEXT,
        comfy_endpoint TEXT,
        avatar_portrait_path TEXT,
        imap_host TEXT,
        imap_port INTEGER,
        imap_user TEXT,
        imap_pass TEXT,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        inbox_sync_enabled INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO user_preferences (id) VALUES (1);
    `,
  },
  {
    name: "010_tasks",
    sql: `
      -- ── Tasks: Projects (containers for tasks) ──
      CREATE TABLE IF NOT EXISTS task_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#34d399',
        icon TEXT NOT NULL DEFAULT '📋',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Seed default project
      INSERT OR IGNORE INTO task_projects (id, name, color, icon) VALUES (1, 'Inbox', '#94a3b8', '📥');

      -- ── Tasks: Labels (tags for tasks) ──
      CREATE TABLE IF NOT EXISTS task_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6b7280',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Tasks: Main task table ──
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',          -- todo, in_progress, done, archived
        priority INTEGER NOT NULL DEFAULT 0,          -- 0=none, 1=low, 2=medium, 3=high, 4=urgent
        project_id INTEGER DEFAULT 1,
        parent_id INTEGER,                            -- For subtasks
        due_date TEXT,                                -- ISO date
        due_time TEXT,                                -- HH:MM
        completed_at TEXT,                            -- When marked done
        sort_order INTEGER NOT NULL DEFAULT 0,        -- For manual reordering
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_rule TEXT,                         -- e.g. "daily", "weekly", "monthly"
        labels TEXT NOT NULL DEFAULT '[]',            -- JSON array of label IDs
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES task_projects(id),
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    `,
  },
  {
    name: "011_calendar",
    sql: `
      -- ── Calendar: Events ──
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL,                     -- ISO date YYYY-MM-DD
        start_time TEXT,                              -- HH:MM (null = all-day)
        end_date TEXT,                                -- ISO date (null = same as start)
        end_time TEXT,                                -- HH:MM
        all_day INTEGER NOT NULL DEFAULT 0,
        location TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#34d399',
        category TEXT NOT NULL DEFAULT 'personal',    -- personal, work, health, social
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_rule TEXT,                         -- daily, weekly, monthly, yearly
        reminder_minutes INTEGER,                     -- minutes before event
        linked_people TEXT NOT NULL DEFAULT '[]',     -- JSON array of people IDs
        linked_task_id INTEGER,                       -- Optional link to a task
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_category ON calendar_events(category);
    `,
  },
  {
    name: "012_habits",
    sql: `
      -- ── Habits ──
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        frequency TEXT NOT NULL DEFAULT 'daily',    -- daily, weekly
        linked_value_id INTEGER,                    -- Links to identity_values.id
        color TEXT NOT NULL DEFAULT '#60a5fa',
        icon TEXT NOT NULL DEFAULT 'Target',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Habit Logs (Check-ins) ──
      CREATE TABLE IF NOT EXISTS habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        date TEXT NOT NULL,                         -- ISO date YYYY-MM-DD
        status TEXT NOT NULL DEFAULT 'completed',   -- completed, skipped
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
        UNIQUE(habit_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
    `,
  },
  {
    name: "013_integrations",
    sql: `
      -- ── Data Sources (Local Folders / Drives) ──
      CREATE TABLE IF NOT EXISTS data_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,                -- Absolute path to the folder/drive
        type TEXT NOT NULL DEFAULT 'folder',      -- folder, drive, healthkit_export
        status TEXT NOT NULL DEFAULT 'active',    -- active, disconnected
        last_scanned TEXT,                        -- ISO datetime of last background sync
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── External MCP Servers ──
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        command TEXT NOT NULL,                    -- e.g., 'npx', 'python3', 'docker'
        args TEXT NOT NULL DEFAULT '[]',          -- JSON array of command arguments
        env TEXT NOT NULL DEFAULT '{}',           -- JSON object of environment variables
        status TEXT NOT NULL DEFAULT 'disconnected', -- connected, disconnected, error
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Add AI execution routing to preferences if it doesn't exist
      -- SQLite doesn't have ADD COLUMN IF NOT EXISTS, so we catch the error gracefully
      -- if it already exists, or we alter the table. For safety in migrations, we will
      -- attempt to add it. (In production SQLite, we'd use pragma table_info to check).
      -- But since we control the DB, we just execute:
      ALTER TABLE user_preferences ADD COLUMN default_execution_mode TEXT NOT NULL DEFAULT 'local_ollama';
      ALTER TABLE user_preferences ADD COLUMN fallback_execution_mode TEXT NOT NULL DEFAULT 'cloud_gemini';
    `,
  },
  {
    name: "014_people_warmth",
    sql: `
      -- Add warmth column to people table
      ALTER TABLE people ADD COLUMN warmth INTEGER DEFAULT 0;
    `,
  },
  {
    name: "015_people_warmth_index",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_people_warmth_name ON people(warmth, name);
    `,
  },
  {
    name: "016_health_documents",
    sql: `
      CREATE TABLE IF NOT EXISTS health_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        file_path TEXT NOT NULL DEFAULT '',
        document_date TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: "017_health_vitals_extension",
    sql: `
      ALTER TABLE health_metrics ADD COLUMN blood_pressure_systolic INTEGER;
      ALTER TABLE health_metrics ADD COLUMN blood_pressure_diastolic INTEGER;
      ALTER TABLE health_metrics ADD COLUMN blood_glucose REAL;
      ALTER TABLE health_metrics ADD COLUMN temperature REAL;
    `,
  },
  {
    name: "018_health_documents_provider_fk",
    sql: `
      ALTER TABLE health_documents ADD COLUMN provider_id INTEGER REFERENCES health_providers(id) ON DELETE SET NULL;
    `,
  },
  {
    name: "019_people_social",
    sql: `
      ALTER TABLE people ADD COLUMN linkedin TEXT;
      ALTER TABLE people ADD COLUMN website TEXT;
      ALTER TABLE people ADD COLUMN address TEXT;
    `,
  },
  {
    name: "020_writing_extensions",
    sql: `
      ALTER TABLE journal_entries ADD COLUMN parent_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL;
      ALTER TABLE journal_entries ADD COLUMN meta_json TEXT DEFAULT '{}';
      ALTER TABLE journal_entries ADD COLUMN is_folder INTEGER DEFAULT 0;
    `,
  },
  {
    name: "021_flow_taste_library",
    sql: `
      /* FLOW: Taste Library: Gold Standard Hero Frames */
      CREATE TABLE IF NOT EXISTS taste_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Untitled',
        brand_name TEXT NOT NULL,
        video_name TEXT NOT NULL,
        frame_index INTEGER NOT NULL,
        timestamp REAL,
        file_path TEXT NOT NULL,
        caption TEXT NOT NULL DEFAULT '',
        vector_id TEXT,
        meta_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_taste_brand ON taste_library(brand_name);
      CREATE INDEX IF NOT EXISTS idx_taste_video ON taste_library(video_name);

      /* FLOW: Brand Contexts: DNA and Styling Guidelines */
      CREATE TABLE IF NOT EXISTS brand_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_name TEXT NOT NULL UNIQUE,
        lora_trigger TEXT,
        color_palette TEXT NOT NULL DEFAULT '[]',
        style_rules TEXT NOT NULL DEFAULT '[]',
        forbidden_tokens TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_brand_context_name ON brand_contexts(brand_name);
    `,
  },
  {
    name: "022_face_clusters",
    sql: `
      /* media_photos: photo files in your robust library */
      CREATE TABLE IF NOT EXISTS media_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,          /* Absolute path to the photo */
        file_name TEXT NOT NULL,
        taken_at TEXT,                           /* ISO datetime */
        location TEXT,                           /* Place name or GPS coordinates */
        metadata_json TEXT NOT NULL DEFAULT '{}',/* Camera / EXIF metadata */
        faces_json TEXT NOT NULL DEFAULT '[]',   /* JSON array of face cluster labels */
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      /* face_clusters: detected face groupings */
      CREATE TABLE IF NOT EXISTS face_clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_label TEXT NOT NULL UNIQUE,      /* e.g. 'cluster_001', 'person_A' */
        person_id INTEGER REFERENCES people(id) ON DELETE SET NULL, /* Links to named contact */
        representative_photo TEXT,               /* Path to hero face thumbnail */
        photo_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_media_photos_faces ON media_photos(faces_json);
      CREATE INDEX IF NOT EXISTS idx_face_clusters_person ON face_clusters(person_id);
    `,
  },
  {
    name: "023_career_hub",
    sql: `
      /* career_timeline: Chronological career timeline entries */
      CREATE TABLE IF NOT EXISTS career_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        division TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        highlights_json TEXT NOT NULL DEFAULT '[]', /* JSON array of highlight strings */
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      /* career_skills: Sourced expertise tags */
      CREATE TABLE IF NOT EXISTS career_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, /* creative, production, technical, tools */
        skill_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      /* career_awards: Television academy and Webby wins */
      CREATE TABLE IF NOT EXISTS career_awards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        award_type TEXT NOT NULL, /* emmy, other */
        title TEXT NOT NULL,
        project TEXT NOT NULL,
        org TEXT NOT NULL,
        year INTEGER,
        result TEXT NOT NULL DEFAULT 'WON', /* WON, nominated */
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      /* career_original_ip: Developed video media formats */
      CREATE TABLE IF NOT EXISTS career_original_ip (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        format TEXT NOT NULL,
        pitched_to TEXT,
        status TEXT NOT NULL DEFAULT 'developed', /* developed, pitched, produced */
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      /* career_job_applications: Substrate application trackers */
      CREATE TABLE IF NOT EXISTS career_job_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        year TEXT NOT NULL,
        docs_json TEXT NOT NULL DEFAULT '[]', /* JSON array: ['resume', 'cover_letter'] */
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: "024_chronicle_narratives",
    sql: `
      /* chronicle_narratives: Daily essences and AI travelogues for Sovereign Chronicles */
      CREATE TABLE IF NOT EXISTS chronicle_narratives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journey_id TEXT NOT NULL,
        day_index INTEGER NOT NULL,
        essence TEXT NOT NULL DEFAULT '',           /* Enforced 30-character daily essence */
        ai_narrative TEXT NOT NULL DEFAULT '',       /* Expanded AI travelogue prose */
        manual_prose TEXT NOT NULL DEFAULT '',       /* User manual editorial overrides */
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(journey_id, day_index)
      );

      CREATE INDEX IF NOT EXISTS idx_chronicle_journey ON chronicle_narratives(journey_id);
    `,
  },
  {
    name: "025_harness",
    sql: `
      -- ── Context Harness: Configurations ──
      CREATE TABLE IF NOT EXISTS harness_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        system_instructions TEXT NOT NULL DEFAULT '',
        target_ai TEXT NOT NULL DEFAULT 'claude', -- 'claude', 'chatgpt', 'gemini', 'cursor', 'ollama'
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Context Harness: Dynamic Sources ──
      CREATE TABLE IF NOT EXISTS harness_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        harness_id INTEGER NOT NULL REFERENCES harness_configs(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,                  -- 'identity_profile', 'identity_values', 'career_timeline', 'writing_folder', 'brand_context'
        source_target_id TEXT,                      -- e.g., folder_id or brand name
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_harness_sources_harness ON harness_sources(harness_id);

      -- Seed default harnesses
      INSERT OR IGNORE INTO harness_configs (id, name, slug, description, system_instructions, target_ai) 
      VALUES (1, 'LinkedIn Ghostwriter', 'linkedin-ghostwriter', 'Optimized for writing punchy, high-impact social posts', 'You write raw, high-impact social media posts for Robert. Keep them punchy and use short, clear sentences. Avoid buzzwords like synergy or innovate. Never use em-dashes.', 'claude');
      
      INSERT OR IGNORE INTO harness_configs (id, name, slug, description, system_instructions, target_ai)
      VALUES (2, 'Technical Architect', 'technical-architect', 'Technical partner for drafting design docs and architecture proposals', 'You are an expert software architect helping Robert design local-first, privacy-respecting systems. Avoid placeholders and keep code samples complete.', 'cursor');
      
      INSERT OR IGNORE INTO harness_configs (id, name, slug, description, system_instructions, target_ai)
      VALUES (3, 'Reflective Coach', 'reflective-coach', 'Neuro-reflective coach using biometric states', 'You are a neuro-reflective coach helping Robert reflect on his biometrics and logs using NCI Level 4 sentence patterns. Do not lecture; ask powerful, short questions.', 'gemini');

      -- Seed default harness sources
      -- LinkedIn Ghostwriter sources: Identity profile & Identity values
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (1, 'identity_profile', NULL, 0);
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (1, 'identity_values', NULL, 1);

      -- Technical Architect sources: Identity profile & Career timeline
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (2, 'identity_profile', NULL, 0);
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (2, 'career_timeline', NULL, 1);

      -- Reflective Coach sources: Identity profile & Identity values
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (3, 'identity_profile', NULL, 0);
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) VALUES (3, 'identity_values', NULL, 1);

      -- Auto-enable harness module in user_preferences if not already present
      UPDATE user_preferences 
      SET enabled_modules = json_insert(enabled_modules, '$[#]', 'harness') 
      WHERE id = 1 AND enabled_modules NOT LIKE '%"harness"%';
    `,
  },
  {
    name: "026_fts_search",
    sql: `
      -- ── FTS5 Search Index Table ──
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        origin_id,      -- ID of the source row or filename
        origin_table,   -- 'people', 'tasks', 'journal_entries', 'calendar_events', 'wiki'
        title,
        content,
        tags
      );

      -- Triggers to auto-sync tasks
      CREATE TRIGGER IF NOT EXISTS trg_tasks_insert AFTER INSERT ON tasks BEGIN
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'tasks', new.title, new.description, new.labels);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tasks_update AFTER UPDATE ON tasks BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'tasks';
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'tasks', new.title, new.description, new.labels);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tasks_delete AFTER DELETE ON tasks BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'tasks';
      END;

      -- Triggers to auto-sync people
      CREATE TRIGGER IF NOT EXISTS trg_people_insert AFTER INSERT ON people BEGIN
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'people', new.name, coalesce(new.role, '') || ' ' || coalesce(new.company, '') || ' ' || coalesce(new.notes, ''), '[]');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_people_update AFTER UPDATE ON people BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'people';
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'people', new.name, coalesce(new.role, '') || ' ' || coalesce(new.company, '') || ' ' || coalesce(new.notes, ''), '[]');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_people_delete AFTER DELETE ON people BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'people';
      END;

      -- Triggers to auto-sync journal_entries
      CREATE TRIGGER IF NOT EXISTS trg_journal_insert AFTER INSERT ON journal_entries BEGIN
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'journal_entries', new.title, new.content, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_journal_update AFTER UPDATE ON journal_entries BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'journal_entries';
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'journal_entries', new.title, new.content, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_journal_delete AFTER DELETE ON journal_entries BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'journal_entries';
      END;

      -- Triggers to auto-sync calendar_events
      CREATE TRIGGER IF NOT EXISTS trg_calendar_insert AFTER INSERT ON calendar_events BEGIN
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'calendar_events', new.title, coalesce(new.description, '') || ' ' || coalesce(new.location, ''), json_array(new.category));
      END;
      CREATE TRIGGER IF NOT EXISTS trg_calendar_update AFTER UPDATE ON calendar_events BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'calendar_events';
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'calendar_events', new.title, coalesce(new.description, '') || ' ' || coalesce(new.location, ''), json_array(new.category));
      END;
      CREATE TRIGGER IF NOT EXISTS trg_calendar_delete AFTER DELETE ON calendar_events BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'calendar_events';
      END;

      -- Initial population of existing rows
      INSERT INTO search_index (origin_id, origin_table, title, content, tags)
      SELECT id, 'tasks', title, description, labels FROM tasks;

      INSERT INTO search_index (origin_id, origin_table, title, content, tags)
      SELECT id, 'people', name, coalesce(role, '') || ' ' || coalesce(company, '') || ' ' || coalesce(notes, ''), '[]' FROM people;

      INSERT INTO search_index (origin_id, origin_table, title, content, tags)
      SELECT id, 'journal_entries', title, content, tags FROM journal_entries;

      INSERT INTO search_index (origin_id, origin_table, title, content, tags)
      SELECT id, 'calendar_events', title, coalesce(description, '') || ' ' || coalesce(location, ''), json_array(category) FROM calendar_events;
    `,
  },
  {
    name: "027_correspondence",
    sql: `
      -- ── Correspondence: Inbox and Action Ledger ──
      CREATE TABLE IF NOT EXISTS correspondence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        platform TEXT NOT NULL,                  -- email, slack, imessage, linkedin
        direction TEXT NOT NULL,                 -- incoming, outgoing
        decision_log TEXT,                       -- AI-extracted summary/action items
        message_id TEXT UNIQUE,                  -- Unique ID to prevent duplicates (e.g. email Message-ID)
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_correspondence_platform ON correspondence(platform);
      CREATE INDEX IF NOT EXISTS idx_correspondence_direction ON correspondence(direction);
      CREATE INDEX IF NOT EXISTS idx_correspondence_created ON correspondence(created_at);

      -- Triggers to auto-sync correspondence to FTS5 search_index
      CREATE TRIGGER IF NOT EXISTS trg_correspondence_insert AFTER INSERT ON correspondence BEGIN
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'correspondence', coalesce(new.subject, 'Message from ' || new.sender), new.body || ' ' || coalesce(new.decision_log, ''), json_array(new.platform));
      END;

      CREATE TRIGGER IF NOT EXISTS trg_correspondence_update AFTER UPDATE ON correspondence BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'correspondence';
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES (new.id, 'correspondence', coalesce(new.subject, 'Message from ' || new.sender), new.body || ' ' || coalesce(new.decision_log, ''), json_array(new.platform));
      END;

      CREATE TRIGGER IF NOT EXISTS trg_correspondence_delete AFTER DELETE ON correspondence BEGIN
        DELETE FROM search_index WHERE origin_id = old.id AND origin_table = 'correspondence';
      END;

      -- Seed some mock incoming and outgoing messages to test features
      INSERT OR IGNORE INTO correspondence (sender, recipient, subject, body, platform, direction, decision_log, created_at)
      VALUES (
        'sarah.k@flowagency.co',
        'robert@sovereign.com',
        'Urgent: Budget approval for LuxAuto campaign video',
        'Hi Robert, we need your final sign-off on the LuxAuto commercial storyboard budget by 4 PM today. The total estimate is $45,000 including pre-viz, post-production, and vertical LoRA training. Please let us know if we are clear to proceed.',
        'email',
        'incoming',
        'Sarah from Flow Agency needs budget approval for LuxAuto video by 4 PM. Estimate is $45,000. Action required: Approve or request revision.',
        datetime('now', '-2 hours')
      );

      INSERT OR IGNORE INTO correspondence (sender, recipient, subject, body, platform, direction, decision_log, created_at)
      VALUES (
        'robert@sovereign.com',
        'casey@celfstudio.com',
        'Next steps for external capture device prototype assembly',
        'Casey, I ordered the remaining INMP441 microphones and PCM5102A DAC breakout boards for the external audio hardware prototype. Let''s plan to meet on Thursday afternoon to assemble the first prototype shell and solder the MCUs.',
        'email',
        'outgoing',
        'Sent details to Casey about hardware parts arrival. Scheduled assembly session on Thursday afternoon.',
        datetime('now', '-1 day')
      );

      -- Auto-enable correspondence module in user_preferences if not already present
      UPDATE user_preferences 
      SET enabled_modules = json_insert(enabled_modules, '$[#]', 'correspondence') 
      WHERE id = 1 AND enabled_modules NOT LIKE '%"correspondence"%';
    `,
  },
  {
    name: "028_three_brains",
    sql: `
      -- Create the root Thinking Garden folder (Human-only Zettelkasten)
      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, meta_json) 
      VALUES ('Thinking Garden', 'Your sacred thinking garden - Zettelkasten atomic notes.', 'note', 1, '{"context_type":"thinking"}');

      -- Create the root AI Context folder
      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, meta_json) 
      VALUES ('AI Context', 'Hierarchical context folders for AI Doing.', 'note', 1, '{"context_type":"doing_root"}');

      -- Create the five AI Doing folders under AI Context
      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json) 
      VALUES ('About Me', 'Persona details, profile preferences, and custom settings.', 'note', 1, (SELECT id FROM journal_entries WHERE title = 'AI Context' AND is_folder = 1), '{"context_type":"doing_about_me"}');

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json) 
      VALUES ('Frameworks', 'SOPs, priority matrices, and performance review templates.', 'note', 1, (SELECT id FROM journal_entries WHERE title = 'AI Context' AND is_folder = 1), '{"context_type":"doing_frameworks"}');

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json) 
      VALUES ('Examples', 'Good and bad copywriting examples for the AI to emulate.', 'note', 1, (SELECT id FROM journal_entries WHERE title = 'AI Context' AND is_folder = 1), '{"context_type":"doing_examples"}');

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json) 
      VALUES ('Knowledge Base', 'Fact bases, source documentation, and research briefs.', 'note', 1, (SELECT id FROM journal_entries WHERE title = 'AI Context' AND is_folder = 1), '{"context_type":"doing_knowledge_base"}');

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json) 
      VALUES ('Knowledge Map', 'Wiki schemas, index maps, and folder connectivity lists.', 'note', 1, (SELECT id FROM journal_entries WHERE title = 'AI Context' AND is_folder = 1), '{"context_type":"doing_knowledge_map"}');

      -- Seed welcome guide documents inside each folder
      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json)
      VALUES (
        'The Nature of Thought',
        '# The Zettelkasten Method for Human Thinking\n\nThis is your Sacred Thinking Garden. It is a local, distraction - free space for insight generation, entirely separate from your task list and workflow doing.\n\nTo grow this garden, follow the three core principles of Zettelkasten:\n1. **Atomic Notes**: Dedicate each note to exactly one single idea or insight. Keep them concise and distilled.\n2. **Connected Notes**: Link notes together using double square brackets or markdown links to establish a lateral lattice of knowledge.\n3. **Processed in Your Own Words**: Do not copy - paste or document raw text. Rephrase ideas to internalize and build mental models.\n\n*Note: AI assistance is blocked by default on this note to protect your cognitive garden from corporate slop.*',
        'note',
        0,
        (SELECT id FROM journal_entries WHERE title = 'Thinking Garden' AND is_folder = 1),
        '{}'
      );

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json)
      VALUES (
        'Profile Preferences',
        '# Profile Preferences & Voice Guidelines\n\n- **Tone**: Professional, clean, slightly poetic but direct.\n- **Pacing**: Short, high - impact sentences.\n- **Strict Constraints**: \n  * Never use em - dashes (always use spaced hyphens instead).\n  * Never use corporate buzzwords like synergy, innovate, or pivot.\n  * Keep paragraphs under three sentences.',
        'note',
        0,
        (SELECT id FROM journal_entries WHERE title = 'About Me' AND is_folder = 1),
        '{}'
      );

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json)
      VALUES (
        'Matty Effort Delegation Matrix',
        '# Effort and Delegation Matrix\n\nUse this matrix to prioritize workflow items rather than the standard Eisenhower urgency matrix:\n\n1. **High Effort + Delegatable**: Assign to local AI swarms or assistant scripts immediately.\n2. **High Effort + Non - Delegatable**: Block focus hours and tackle with human deep - thinking.\n3. **Low Effort + Delegatable**: Queue for background automation.\n4. **Low Effort + Non - Delegatable**: Execute immediately to clear cognitive overhead.',
        'note',
        0,
        (SELECT id FROM journal_entries WHERE title = 'Frameworks' AND is_folder = 1),
        '{}'
      );

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json)
      VALUES (
        'Sovereign Copywriting Benchmarks',
        '# Copywriting Benchmarks (Good vs Bad)\n\n### Good Example (Punchy & Direct):\n"We spent three months building a local - first ring tracker. No cloud, no subscription fees. Just your biometrics on your own machine. Deployed today."\n\n### Bad Example (Generic AI Slop):\n"We are thrilled to announce the launch of our revolutionary, next - generation wellness tracking solution that synergizes ring vitals with cloud - based AI to empower your daily lifestyle journey!"',
        'note',
        0,
        (SELECT id FROM journal_entries WHERE title = 'Examples' AND is_folder = 1),
        '{}'
      );

      INSERT OR IGNORE INTO journal_entries (title, content, mode, is_folder, parent_id, meta_json)
      VALUES (
        'Orchestration Index',
        '# Context Orchestration Schema\n\nThis map outlines the connectivity of the AI Doing space:\n- **Profile & Values** - Injected into all persona harnesses as the primary layer.\n- **Sovereign Frameworks** - Injected as TIER 2 guidelines to govern decision rationale.\n- **Writing Benchmarks** - Injected as examples to guide output formatting.\n- **Knowledge Base Files** - RAG targets containing context and project facts.',
        'note',
        0,
        (SELECT id FROM journal_entries WHERE title = 'Knowledge Map' AND is_folder = 1),
        '{}'
      );

      -- Seed harness sources for the new context folder types
      -- LinkedIn Ghostwriter (id = 1)
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (1, 'doing_about_me', (SELECT id FROM journal_entries WHERE title = 'About Me' AND is_folder = 1), 2);

      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (1, 'doing_frameworks', (SELECT id FROM journal_entries WHERE title = 'Frameworks' AND is_folder = 1), 3);

      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (1, 'doing_examples', (SELECT id FROM journal_entries WHERE title = 'Examples' AND is_folder = 1), 4);

      -- Technical Architect (id = 2)
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (2, 'doing_about_me', (SELECT id FROM journal_entries WHERE title = 'About Me' AND is_folder = 1), 2);

      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (2, 'doing_frameworks', (SELECT id FROM journal_entries WHERE title = 'Frameworks' AND is_folder = 1), 3);

      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (2, 'doing_knowledge_base', (SELECT id FROM journal_entries WHERE title = 'Knowledge Base' AND is_folder = 1), 4);

      -- Reflective Coach (id = 3)
      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order) 
      VALUES (3, 'doing_about_me', (SELECT id FROM journal_entries WHERE title = 'About Me' AND is_folder = 1), 2);

      INSERT OR IGNORE INTO harness_sources (harness_id, source_type, source_target_id, sort_order)
      VALUES (3, 'doing_frameworks', (SELECT id FROM journal_entries WHERE title = 'Frameworks' AND is_folder = 1), 3);
    `,
  },
  {
    name: "029_chunk_embeddings",
    sql: `
      -- ── Semantic Retrieval: Persistent embedding cache ──
      -- Stores one vector per RAG chunk, keyed by a stable hash of its
      -- content so chunks are only re-embedded when their text changes.
      -- This replaces the previous behavior of rebuilding ~1,500 chunks
      -- with no vectors on every request.
      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT NOT NULL UNIQUE,   -- sha256 of source+title+content
        source       TEXT NOT NULL,          -- 'people', 'career', 'health', ...
        title        TEXT NOT NULL DEFAULT '',
        content      TEXT NOT NULL DEFAULT '',
        model        TEXT NOT NULL,          -- embedding model used (e.g. nomic-embed-text)
        dim          INTEGER NOT NULL,       -- vector dimensionality
        vector       BLOB NOT NULL,          -- Float32Array bytes
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_source ON chunk_embeddings(source);
      CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model  ON chunk_embeddings(model);
    `,
  },
  {
    name: "030_voice_avatar_preferences",
    sql: `
      ALTER TABLE user_preferences ADD COLUMN tts_provider TEXT NOT NULL DEFAULT 'native';
      ALTER TABLE user_preferences ADD COLUMN tts_endpoint TEXT;
      ALTER TABLE user_preferences ADD COLUMN tts_ref_audio TEXT;
      ALTER TABLE user_preferences ADD COLUMN tts_ref_text TEXT;
      ALTER TABLE user_preferences ADD COLUMN comfy_endpoint TEXT;
      ALTER TABLE user_preferences ADD COLUMN avatar_portrait_path TEXT;
    `,
  },
  {
    name: "031_people_warmth",
    sql: `
      ALTER TABLE people ADD COLUMN warmth REAL DEFAULT 0.5;
    `,
  },
  {
    name: "032_sovereign_inbox_settings",
    sql: `
      ALTER TABLE user_preferences ADD COLUMN imap_host TEXT;
      ALTER TABLE user_preferences ADD COLUMN imap_port INTEGER;
      ALTER TABLE user_preferences ADD COLUMN imap_user TEXT;
      ALTER TABLE user_preferences ADD COLUMN imap_pass TEXT;
      ALTER TABLE user_preferences ADD COLUMN smtp_host TEXT;
      ALTER TABLE user_preferences ADD COLUMN smtp_port INTEGER;
      ALTER TABLE user_preferences ADD COLUMN smtp_user TEXT;
      ALTER TABLE user_preferences ADD COLUMN smtp_pass TEXT;
      ALTER TABLE user_preferences ADD COLUMN inbox_sync_enabled INTEGER DEFAULT 0;
    `,
  },
  {
    name: "033_correspondence_message_id",
    sql: `
      ALTER TABLE correspondence ADD COLUMN message_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_correspondence_message_id ON correspondence(message_id);
    `,
  },
  {
    name: "034_rebalance_proposals",
    sql: `
      CREATE TABLE IF NOT EXISTS rebalance_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        task_id INTEGER NOT NULL,
        original_date TEXT NOT NULL,
        proposed_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(task_id) REFERENCES tasks(id)
      );
      CREATE INDEX IF NOT EXISTS idx_rebalance_date ON rebalance_proposals(date);
      CREATE INDEX IF NOT EXISTS idx_rebalance_status ON rebalance_proposals(status);
    `,
  },
  {
    name: "035_tasks_external_id",
    sql: `
      ALTER TABLE tasks ADD COLUMN external_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external_id ON tasks(external_id);
    `,
  },
  {
    name: "036_data_sources_error_message",
    sql: `
      ALTER TABLE data_sources ADD COLUMN error_message TEXT;
    `,
  },
];


