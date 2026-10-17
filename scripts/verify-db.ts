/**
 * Verifies the Supabase migration, the seed and Row Level Security without Docker.
 * Runs everything in an embedded Postgres (PGlite) with minimal stand-ins for
 * Supabase's auth and storage schemas, then checks tenant isolation as different users.
 * Run with: npm run db:verify
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { seedId } from "../lib/demo/seed";

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
  email_change_token_new text, recovery_token text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id) on delete cascade, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider)
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant select on auth.users to authenticated;

create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
`;

const ids = {
  workspace: seedId("workspace:vertex"),
  alex: seedId("user:alex"),
  sarah: seedId("user:sarah"),
  marcus: seedId("user:marcus"),
  outsider: "00000000-0000-4000-8000-0000000000aa",
  jordan: "00000000-0000-4000-8000-0000000000bb",
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);

  for (const file of ["20261017000000_initial_schema.sql"]) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  check("migration applies cleanly", true);

  await db.exec(readFileSync(path.join(root, "supabase", "seed.sql"), "utf8"));
  const counts = await db.query<{ clients: number; projects: number; invoices: number; tasks: number }>(
    `select (select count(*)::int from public.clients) clients, (select count(*)::int from public.projects) projects,
            (select count(*)::int from public.invoices) invoices, (select count(*)::int from public.tasks) tasks`,
  );
  const c = counts.rows[0];
  check("seed loads", c.clients === 13 && c.projects === 11 && c.tasks > 40 && c.invoices > 40, JSON.stringify(c));

  // Signup trigger: a new user with workspace metadata gets a profile, a workspace and a Pro trial.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'outsider@example.com', '{"full_name":"Olive Outsider","workspace_name":"Outsider LLC"}')`,
    [ids.outsider],
  );
  const boot = await db.query<{ role: string; plan: string; status: string }>(
    `select m.role, s.plan, s.status from public.workspace_members m join public.subscriptions s on s.workspace_id = m.workspace_id where m.user_id = $1`,
    [ids.outsider],
  );
  check("signup trigger creates workspace + owner + trial", boot.rows[0]?.role === "owner" && boot.rows[0]?.plan === "pro" && boot.rows[0]?.status === "trialing");

  const as = async (userId: string) => {
    await db.exec(`reset role;`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
    await db.exec(`set role authenticated;`);
  };
  const count = async (sql: string, params: unknown[] = []) => Number((await db.query<{ n: number }>(sql, params)).rows[0]?.n ?? 0);
  const fails = async (sql: string, params: unknown[] = []) => {
    try {
      await db.query(sql, params);
      return false;
    } catch {
      return true;
    }
  };

  // --- Member of the workspace sees its data
  await as(ids.alex);
  check("owner sees workspace clients", (await count(`select count(*)::int n from public.clients`)) === 13);
  check("owner sees only their own notifications", (await count(`select count(*)::int n from public.notifications where user_id <> $1`, [ids.alex])) === 0);

  // --- Outsider cannot see or touch another workspace
  await as(ids.outsider);
  check("outsider sees no Vertex clients", (await count(`select count(*)::int n from public.clients`)) === 0);
  check("outsider sees no Vertex invoices", (await count(`select count(*)::int n from public.invoices`)) === 0);
  check("outsider sees only their own workspace", (await count(`select count(*)::int n from public.workspaces`)) === 1);
  check("outsider can't read Vertex profiles", (await count(`select count(*)::int n from public.profiles where id = $1`, [ids.alex])) === 0);
  check(
    "outsider can't insert a client into Vertex",
    await fails(`insert into public.clients (workspace_id, company) values ($1, 'Injected Co')`, [ids.workspace]),
  );
  await db.query(`update public.projects set name = 'Hacked' where workspace_id = $1`, [ids.workspace]);
  await as(ids.alex);
  check("outsider's update to Vertex projects had no effect", (await count(`select count(*)::int n from public.projects where name = 'Hacked'`)) === 0);

  // --- Composite foreign keys stop cross-workspace references
  await as(ids.outsider);
  const own = (await db.query<{ id: string }>(`select workspace_id id from public.workspace_members where user_id = $1`, [ids.outsider])).rows[0].id;
  const vertexProject = seedId("project:lunar-app");
  check(
    "can't attach a task to another workspace's project",
    await fails(`insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'Sneaky')`, [own, vertexProject]),
  );
  check(
    "can't assign a task to a non-member",
    await fails(`insert into public.tasks (workspace_id, assignee_id, title) values ($1, $2, 'Sneaky')`, [own, ids.alex]),
  );

  // --- Role checks inside the workspace
  await as(ids.marcus);
  await db.query(`delete from public.clients where workspace_id = $1`, [ids.workspace]);
  await as(ids.alex);
  check("members can't delete clients", (await count(`select count(*)::int n from public.clients`)) === 13);
  await as(ids.marcus);
  await db.query(`update public.workspace_members set role = 'owner' where user_id = $1`, [ids.marcus]);
  await as(ids.alex);
  check("members can't promote themselves", (await count(`select count(*)::int n from public.workspace_members where user_id = $1 and role = 'owner'`, [ids.marcus])) === 0);
  await as(ids.sarah);
  check(
    "admins can't grant the owner role",
    await fails(`update public.workspace_members set role = 'owner' where user_id = $1`, [ids.marcus]),
  );
  await as(ids.alex);
  check(
    "the last owner can't be demoted",
    await fails(`update public.workspace_members set role = 'admin' where user_id = $1`, [ids.alex]),
  );
  await db.query(`delete from public.workspace_members where user_id = $1`, [ids.alex]);
  check("owners can't be removed through the API", (await count(`select count(*)::int n from public.workspace_members where user_id = $1`, [ids.alex])) === 1);
  check("only draft invoices can be deleted", (await db.query(`delete from public.invoices where status = 'paid'`)).affectedRows === 0);
  check("subscriptions are read-only for users", (await db.query(`update public.subscriptions set plan = 'business'`)).affectedRows === 0);
  check(
    "activity log is append-only as yourself",
    await fails(`insert into public.activity_logs (workspace_id, actor_id, action, entity_type) values ($1, $2, 'x', 'y')`, [ids.workspace, ids.marcus]),
  );

  // --- Invitation flow
  await db.exec(`reset role;`);
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'jordan@vertex-demo.com', '{"full_name":"Jordan Blake"}')`, [ids.jordan]);
  const token = (await db.query<{ token: string }>(`select token from public.workspace_invitations where email = 'jordan@vertex-demo.com'`)).rows[0].token;
  await as(ids.outsider);
  check("an invitation can't be used by a different email", await fails(`select public.accept_invitation($1)`, [token]));
  await as(ids.jordan);
  await db.query(`select public.accept_invitation($1)`, [token]);
  check("invited user joins with the invited role", (await count(`select count(*)::int n from public.workspace_members where user_id = $1 and role = 'member'`, [ids.jordan])) === 1);
  check("new member can now see the workspace", (await count(`select count(*)::int n from public.clients`)) === 13);

  // --- Storage policies
  await as(ids.outsider);
  check(
    "outsider can't upload into Vertex storage",
    await fails(`insert into storage.objects (bucket_id, name) values ('workspace-files', $1)`, [`${ids.workspace}/clients/x.txt`]),
  );
  await as(ids.marcus);
  check(
    "members can upload into their workspace storage",
    !(await fails(`insert into storage.objects (bucket_id, name) values ('workspace-files', $1)`, [`${ids.workspace}/clients/ok.txt`])),
  );

  await db.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll database checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
