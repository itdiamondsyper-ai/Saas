import "server-only";
import { randomUUID } from "node:crypto";
import { DbError, type Db, type Filter, type QueryOptions } from "@/lib/db/types";
import type { InsertRow, TableName, Tables, UpdateRow } from "@/types/database";
import { mutateDemoState, readDemoState, type DemoState } from "./store";

type AnyRow = Record<string, unknown>;
type TableData = DemoState["tables"];

function rowsOf(tables: TableData, table: TableName): AnyRow[] {
  return tables[table] as unknown as AnyRow[];
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function matches<K extends TableName>(row: AnyRow, filter: Filter<K>): boolean {
  for (const [col, value] of Object.entries(filter.eq ?? {})) {
    if ((row[col] ?? null) !== value) return false;
  }
  for (const [col, value] of Object.entries(filter.neq ?? {})) {
    if ((row[col] ?? null) === value) return false;
  }
  for (const [col, values] of Object.entries(filter.in ?? {})) {
    if (!(values as unknown[]).includes(row[col] ?? null)) return false;
  }
  for (const [col, value] of Object.entries(filter.gte ?? {})) {
    if (row[col] === null || row[col] === undefined || compare(row[col], value) < 0) return false;
  }
  for (const [col, value] of Object.entries(filter.lte ?? {})) {
    if (row[col] === null || row[col] === undefined || compare(row[col], value) > 0) return false;
  }
  for (const [col, value] of Object.entries(filter.lt ?? {})) {
    if (row[col] === null || row[col] === undefined || compare(row[col], value) >= 0) return false;
  }
  if (filter.search && filter.search.term.trim()) {
    const term = filter.search.term.trim().toLowerCase();
    const hit = filter.search.columns.some((col) => String(row[col] ?? "").toLowerCase().includes(term));
    if (!hit) return false;
  }
  return true;
}

const UNIQUE_KEYS: Partial<Record<TableName, string[][]>> = {
  workspaces: [["slug"]],
  workspace_members: [["workspace_id", "user_id"]],
  project_members: [["project_id", "user_id"]],
  invoices: [["workspace_id", "number"]],
  subscriptions: [["workspace_id"]],
  workspace_invitations: [["token"]],
  files: [["storage_path"]],
};

function assertUnique(tables: TableData, table: TableName, row: AnyRow, ignoreId?: unknown) {
  for (const key of UNIQUE_KEYS[table] ?? []) {
    const clash = rowsOf(tables, table).some(
      (existing) => existing !== row && existing.id !== ignoreId && key.every((col) => existing[col] === row[col]),
    );
    if (clash) throw new DbError(`Duplicate value for ${table}.${key.join(",")}`, "unique_violation");
  }
}

function setNull(tables: TableData, table: TableName, column: string, predicate: (row: AnyRow) => boolean) {
  for (const row of rowsOf(tables, table)) {
    if (predicate(row)) row[column] = null;
  }
}

function deleteWhere(tables: TableData, table: TableName, predicate: (row: AnyRow) => boolean) {
  const victims = rowsOf(tables, table).filter(predicate);
  if (victims.length) cascade(tables, table, victims);
  (tables as unknown as Record<string, AnyRow[]>)[table] = rowsOf(tables, table).filter((r) => !victims.includes(r));
}

/** Mirrors the ON DELETE rules in the SQL migration. */
function cascade(tables: TableData, table: TableName, victims: AnyRow[]) {
  const ids = new Set(victims.map((v) => v.id));
  switch (table) {
    case "workspaces": {
      const all: TableName[] = [
        "workspace_members", "workspace_invitations", "clients", "projects", "project_members", "tasks",
        "task_comments", "invoices", "invoice_items", "expenses", "files", "notifications", "activity_logs",
        "subscriptions", "billing_history",
      ];
      for (const t of all) {
        (tables as unknown as Record<string, AnyRow[]>)[t] = rowsOf(tables, t).filter((r) => !ids.has(r.workspace_id));
      }
      break;
    }
    case "workspace_members": {
      for (const m of victims) {
        const sameMember = (col: string) => (r: AnyRow) => r.workspace_id === m.workspace_id && r[col] === m.user_id;
        setNull(tables, "clients", "owner_id", sameMember("owner_id"));
        setNull(tables, "projects", "owner_id", sameMember("owner_id"));
        setNull(tables, "tasks", "assignee_id", sameMember("assignee_id"));
        deleteWhere(tables, "project_members", sameMember("user_id"));
      }
      break;
    }
    case "clients": {
      if (rowsOf(tables, "invoices").some((inv) => ids.has(inv.client_id))) {
        throw new DbError("Client has invoices", "foreign_key_violation");
      }
      setNull(tables, "projects", "client_id", (r) => ids.has(r.client_id));
      deleteWhere(tables, "files", (r) => ids.has(r.client_id));
      break;
    }
    case "projects": {
      deleteWhere(tables, "tasks", (r) => ids.has(r.project_id));
      deleteWhere(tables, "project_members", (r) => ids.has(r.project_id));
      deleteWhere(tables, "files", (r) => ids.has(r.project_id));
      setNull(tables, "invoices", "project_id", (r) => ids.has(r.project_id));
      setNull(tables, "expenses", "project_id", (r) => ids.has(r.project_id));
      break;
    }
    case "tasks":
      deleteWhere(tables, "task_comments", (r) => ids.has(r.task_id));
      break;
    case "invoices":
      deleteWhere(tables, "invoice_items", (r) => ids.has(r.invoice_id));
      break;
    case "profiles":
      deleteWhere(tables, "workspace_members", (r) => ids.has(r.user_id));
      deleteWhere(tables, "notifications", (r) => ids.has(r.user_id));
      break;
    default:
      break;
  }
}

const TABLES_WITHOUT_ID: TableName[] = ["project_members"];

function prepareInsert<K extends TableName>(table: K, values: InsertRow<K>): AnyRow {
  const now = new Date().toISOString();
  const row = { ...(values as AnyRow) };
  if (!TABLES_WITHOUT_ID.includes(table)) row.id ??= randomUUID();
  row.created_at ??= now;
  row.updated_at ??= now;
  return row;
}

export const demoDb: Db = {
  async select<K extends TableName>(table: K, options: QueryOptions<K> = {}) {
    let rows = rowsOf(readDemoState().tables, table).filter((r) => matches(r, options));
    for (const order of [...(options.order ?? [])].reverse()) {
      rows = [...rows].sort((a, b) => compare(a[order.column], b[order.column]) * (order.ascending === false ? -1 : 1));
    }
    const count = rows.length;
    const start = options.offset ?? 0;
    const end = options.limit !== undefined ? start + options.limit : undefined;
    return { rows: structuredClone(rows.slice(start, end)) as unknown as Tables[K][], count };
  },

  async first<K extends TableName>(table: K, options: QueryOptions<K> = {}) {
    const { rows } = await demoDb.select(table, { ...options, limit: 1 });
    return rows[0] ?? null;
  },

  async insert<K extends TableName>(table: K, values: InsertRow<K>) {
    const [row] = await demoDb.insertMany(table, [values]);
    return row;
  },

  async insertMany<K extends TableName>(table: K, values: InsertRow<K>[]) {
    return mutateDemoState((state) => {
      const inserted = values.map((v) => prepareInsert(table, v));
      for (const row of inserted) {
        rowsOf(state.tables, table).push(row);
        assertUnique(state.tables, table, row);
      }
      return structuredClone(inserted) as unknown as Tables[K][];
    });
  },

  async update<K extends TableName>(table: K, filter: Filter<K>, patch: UpdateRow<K>) {
    return mutateDemoState((state) => {
      const now = new Date().toISOString();
      const updated: AnyRow[] = [];
      for (const row of rowsOf(state.tables, table)) {
        if (!matches(row, filter)) continue;
        Object.assign(row, patch, { updated_at: now });
        assertUnique(state.tables, table, row);
        updated.push(row);
      }
      return structuredClone(updated) as unknown as Tables[K][];
    });
  },

  async remove<K extends TableName>(table: K, filter: Filter<K>) {
    return mutateDemoState((state) => {
      const before = rowsOf(state.tables, table).length;
      deleteWhere(state.tables, table, (r) => matches(r, filter));
      return before - rowsOf(state.tables, table).length;
    });
  },
};
