import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError, sanitizeSearchTerm, type Db, type Filter, type QueryOptions } from "@/lib/db/types";
import type { InsertRow, TableName, Tables, UpdateRow } from "@/types/database";

/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST builders are untyped without generated types */

function applyFilter<K extends TableName>(query: any, filter: Filter<K>) {
  let q = query;
  for (const [col, value] of Object.entries(filter.eq ?? {})) {
    q = value === null ? q.is(col, null) : q.eq(col, value);
  }
  for (const [col, value] of Object.entries(filter.neq ?? {})) {
    q = value === null ? q.not(col, "is", null) : q.neq(col, value);
  }
  for (const [col, values] of Object.entries(filter.in ?? {})) {
    q = q.in(col, values as unknown[]);
  }
  for (const [col, value] of Object.entries(filter.gte ?? {})) q = q.gte(col, value);
  for (const [col, value] of Object.entries(filter.lte ?? {})) q = q.lte(col, value);
  for (const [col, value] of Object.entries(filter.lt ?? {})) q = q.lt(col, value);
  if (filter.search) {
    const term = sanitizeSearchTerm(filter.search.term);
    if (term) q = q.or(filter.search.columns.map((c) => `${c}.ilike.%${term}%`).join(","));
  }
  return q;
}

function toDbError(error: { code?: string; message: string }): DbError {
  if (error.code === "23505") return new DbError(error.message, "unique_violation");
  if (error.code === "23503") return new DbError(error.message, "foreign_key_violation");
  if (error.code === "42501" || error.code === "PGRST301") return new DbError(error.message, "not_allowed");
  return new DbError(error.message);
}

export function createSupabaseDb(client: SupabaseClient): Db {
  const db: Db = {
    async select<K extends TableName>(table: K, options: QueryOptions<K> = {}) {
      let q: any = client.from(table).select("*", { count: "exact" });
      q = applyFilter(q, options);
      for (const order of options.order ?? []) q = q.order(order.column, { ascending: order.ascending !== false });
      if (options.limit !== undefined) {
        const from = options.offset ?? 0;
        q = q.range(from, from + options.limit - 1);
      }
      const { data, error, count } = await q;
      if (error) throw toDbError(error);
      return { rows: (data ?? []) as Tables[K][], count: count ?? data?.length ?? 0 };
    },

    async first<K extends TableName>(table: K, options: QueryOptions<K> = {}) {
      const { rows } = await db.select(table, { ...options, limit: 1 });
      return rows[0] ?? null;
    },

    async insert<K extends TableName>(table: K, values: InsertRow<K>) {
      const { data, error } = await (client.from(table) as any).insert(values).select("*").single();
      if (error) throw toDbError(error);
      return data as Tables[K];
    },

    async insertMany<K extends TableName>(table: K, values: InsertRow<K>[]) {
      if (!values.length) return [];
      const { data, error } = await (client.from(table) as any).insert(values).select("*");
      if (error) throw toDbError(error);
      return (data ?? []) as Tables[K][];
    },

    async update<K extends TableName>(table: K, filter: Filter<K>, patch: UpdateRow<K>) {
      const q = applyFilter((client.from(table) as any).update(patch), filter);
      const { data, error } = await q.select("*");
      if (error) throw toDbError(error);
      return (data ?? []) as Tables[K][];
    },

    async remove<K extends TableName>(table: K, filter: Filter<K>) {
      const q = applyFilter((client.from(table) as any).delete({ count: "exact" }), filter);
      const { error, count } = await q;
      if (error) throw toDbError(error);
      return count ?? 0;
    },
  };
  return db;
}
