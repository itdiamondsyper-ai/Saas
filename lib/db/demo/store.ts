import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildSeed, type SeedData } from "@/lib/demo/seed";
import { hashPassword } from "@/lib/auth/password";

// Local JSON-file persistence used when Supabase is not configured ("demo mode").
// Good for local development, demos and end-to-end tests. Not for production data:
// on serverless hosts the file lives in /tmp and resets when the instance recycles.

export interface DemoUser {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
}

export interface DemoSession {
  id: string;
  user_id: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export interface DemoResetToken {
  token_hash: string;
  user_id: string;
  expires_at: string;
}

export interface DemoState {
  version: number;
  tables: SeedData["tables"];
  auth: {
    users: DemoUser[];
    sessions: DemoSession[];
    resetTokens: DemoResetToken[];
  };
}

const STATE_VERSION = 1;

export function demoDataDir(): string {
  if (process.env.DEMO_DATA_DIR) return path.resolve(process.env.DEMO_DATA_DIR);
  return process.env.VERCEL ? "/tmp/flowpilot-demo" : path.join(process.cwd(), ".data");
}

const stateFile = () => path.join(demoDataDir(), "demo-db.json");
export const demoStorageDir = () => path.join(demoDataDir(), "storage");

let cache: { state: DemoState; mtimeMs: number; file: string } | null = null;

function createInitialState(): DemoState {
  const seed = buildSeed(new Date());
  const now = new Date().toISOString();
  for (const [objectPath, body] of Object.entries(seed.fileContents)) {
    const target = path.join(demoStorageDir(), "workspace-files", objectPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return {
    version: STATE_VERSION,
    tables: seed.tables,
    auth: {
      users: seed.users.map((u) => ({
        id: u.id,
        email: u.email,
        password_hash: hashPassword(u.password),
        email_verified: true,
        created_at: now,
      })),
      sessions: [],
      resetTokens: [],
    },
  };
}

function writeState(state: DemoState) {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
  cache = { state, mtimeMs: fs.statSync(file).mtimeMs, file };
}

function loadState(): DemoState {
  const file = stateFile();
  if (!fs.existsSync(file)) {
    const state = createInitialState();
    writeState(state);
    return state;
  }
  const { mtimeMs } = fs.statSync(file);
  if (cache && cache.file === file && cache.mtimeMs === mtimeMs) return cache.state;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DemoState;
  if (parsed.version !== STATE_VERSION) {
    const state = createInitialState();
    writeState(state);
    return state;
  }
  cache = { state: parsed, mtimeMs, file };
  return parsed;
}

/** Read-only access. Callers must not mutate the returned state. */
export function readDemoState(): DemoState {
  return loadState();
}

/**
 * Applies a mutation and persists it. Node runs this synchronously, so concurrent
 * requests in one server process cannot interleave inside a mutation.
 */
export function mutateDemoState<T>(fn: (state: DemoState) => T): T {
  const state = structuredClone(loadState());
  const result = fn(state);
  writeState(state);
  return result;
}

/** Deletes all demo data; the next read re-seeds. Used by tests and `npm run demo:reset`. */
export function resetDemoState() {
  fs.rmSync(demoDataDir(), { recursive: true, force: true });
  cache = null;
}
