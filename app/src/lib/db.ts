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

// Data dir defaults to <cwd>/../data, but can be pinned via RUDDER_DATA_DIR
// so the DB resolves correctly when launched from elsewhere (e.g. an MCP client).
const DB_DIR = process.env.RUDDER_DATA_DIR || path.join(process.cwd(), "..", "data");
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
    name: "025_identity_extend",
    sql: `
      -- Richer identity: a one-line headline, an "operating manual" (how you
      -- work / how to talk to you), and what you're currently working toward.
      ALTER TABLE identity_profile ADD COLUMN headline TEXT NOT NULL DEFAULT '';
      ALTER TABLE identity_profile ADD COLUMN operating_manual TEXT NOT NULL DEFAULT '';
      ALTER TABLE identity_profile ADD COLUMN goals TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    name: "026_identity_relationships",
    sql: `
      -- The key people in your life, and who they are to you. Indexed into
      -- memory so "who is Sam to me" resolves.
      CREATE TABLE IF NOT EXISTS identity_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT '',       -- sister, partner, mentor, …
        note TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];


