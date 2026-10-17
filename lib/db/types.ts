import type { InsertRow, TableName, Tables, UpdateRow } from "@/types/database";

type Column<K extends TableName> = keyof Tables[K] & string;
type Scalar = string | number | boolean | null;

export interface Filter<K extends TableName> {
  /** column = value (null means IS NULL) */
  eq?: Partial<Record<Column<K>, Scalar>>;
  /** column <> value */
  neq?: Partial<Record<Column<K>, Scalar>>;
  /** column IN (...) */
  in?: Partial<Record<Column<K>, readonly Scalar[]>>;
  gte?: Partial<Record<Column<K>, string | number>>;
  lte?: Partial<Record<Column<K>, string | number>>;
  lt?: Partial<Record<Column<K>, string | number>>;
  /** Case-insensitive substring match across any of the columns. */
  search?: { columns: Column<K>[]; term: string };
}

export interface QueryOptions<K extends TableName> extends Filter<K> {
  order?: { column: Column<K>; ascending?: boolean }[];
  limit?: number;
  offset?: number;
}

export interface QueryResult<K extends TableName> {
  rows: Tables[K][];
  /** Total rows matching the filter, ignoring limit/offset. */
  count: number;
}

/**
 * Minimal persistence port used by the service layer. Two adapters implement it:
 * the Supabase adapter (Postgres + RLS) and the local demo adapter (JSON file).
 * Services must always scope queries by workspace_id; RLS enforces it again in Postgres.
 */
export interface Db {
  select<K extends TableName>(table: K, options?: QueryOptions<K>): Promise<QueryResult<K>>;
  first<K extends TableName>(table: K, options?: QueryOptions<K>): Promise<Tables[K] | null>;
  insert<K extends TableName>(table: K, values: InsertRow<K>): Promise<Tables[K]>;
  insertMany<K extends TableName>(table: K, values: InsertRow<K>[]): Promise<Tables[K][]>;
  update<K extends TableName>(table: K, filter: Filter<K>, patch: UpdateRow<K>): Promise<Tables[K][]>;
  remove<K extends TableName>(table: K, filter: Filter<K>): Promise<number>;
}

export class DbError extends Error {
  constructor(
    message: string,
    public readonly code: "unique_violation" | "foreign_key_violation" | "not_allowed" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "DbError";
  }
}

/** Escapes a user search term so it is safe inside a PostgREST `or` filter. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
