import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the Rudder project (parent of cli/) */
export const ROOT_DIR = path.resolve(__dirname, "..", "..");

/** Where all data lives */
export const DATA_DIR = path.join(ROOT_DIR, "data");

/** Main SQLite database */
export const RUDDER_DB_PATH = path.join(DATA_DIR, "rudder.db");

/** Next.js app directory */
export const APP_DIR = path.join(ROOT_DIR, "app");

/** Backup directory */
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

/** Default ports */
export const DEFAULT_PORT = 3100;

/** Ollama default endpoint */
export const OLLAMA_DEFAULT_URL = "http://localhost:11434";

/** Version */
export const VERSION = "1.0.0";
