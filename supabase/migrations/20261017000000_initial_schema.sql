-- FlowPilot initial schema
-- Multi-tenant workspace model secured with Row Level Security.
-- Every tenant-owned row carries workspace_id, and child rows use composite
-- foreign keys so they can never point at a parent in another workspace.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.client_status as enum ('lead', 'active', 'inactive', 'archived');
create type public.project_status as enum ('planning', 'active', 'in_review', 'completed', 'on_hold');
create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'review', 'done');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
create type public.plan_tier as enum ('starter', 'pro', 'business');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  job_title text,
  notification_prefs jsonb not null default
    '{"email": true, "invoices": true, "tasks": true, "weekly_report": false}'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  logo_url text,
  industry text,
  team_size text,
  primary_goal text,
  onboarding_completed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token text not null unique
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_invitations_ws_idx on public.workspace_invitations (workspace_id);
create unique index workspace_invitations_pending_email_idx
  on public.workspace_invitations (workspace_id, lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 120),
  contact_name text not null default '',
  email text,
  phone text,
  website text,
  industry text,
  address text,
  status public.client_status not null default 'lead',
  tags text[] not null default '{}',
  notes text,
  owner_id uuid,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_id, owner_id)
    references public.workspace_members (workspace_id, user_id) on delete set null (owner_id)
);
create index clients_workspace_idx on public.clients (workspace_id, status);
create index clients_workspace_created_idx on public.clients (workspace_id, created_at);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid,
  owner_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  status public.project_status not null default 'planning',
  priority public.priority_level not null default 'medium',
  start_date date,
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (client_id, workspace_id)
    references public.clients (id, workspace_id) on delete set null (client_id),
  foreign key (workspace_id, owner_id)
    references public.workspace_members (workspace_id, user_id) on delete set null (owner_id)
);
create index projects_workspace_idx on public.projects (workspace_id, status);
create index projects_client_idx on public.projects (client_id);

create table public.project_members (
  project_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);
create index project_members_ws_idx on public.project_members (workspace_id);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  assignee_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status public.task_status not null default 'todo',
  priority public.priority_level not null default 'medium',
  due_date date,
  labels text[] not null default '{}',
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade,
  foreign key (workspace_id, assignee_id)
    references public.workspace_members (workspace_id, user_id) on delete set null (assignee_id)
);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status, position);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_due_idx on public.tasks (workspace_id, due_date);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, workspace_id)
    references public.tasks (id, workspace_id) on delete cascade
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null,
  project_id uuid,
  number text not null,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  currency text not null default 'USD',
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, number),
  check (due_date >= issue_date),
  foreign key (client_id, workspace_id)
    references public.clients (id, workspace_id) on delete restrict,
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete set null (project_id)
);
create index invoices_workspace_status_idx on public.invoices (workspace_id, status);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_paid_idx on public.invoices (workspace_id, paid_at);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid not null,
  description text not null check (char_length(description) between 1 and 300),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  amount numeric(12, 2) not null check (amount >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invoice_id, workspace_id)
    references public.invoices (id, workspace_id) on delete cascade
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

-- ---------------------------------------------------------------------------
-- Expenses (used for profit and project profitability)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  description text not null check (char_length(description) between 1 and 200),
  category text not null default 'general',
  amount numeric(12, 2) not null check (amount >= 0),
  incurred_on date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete set null (project_id)
);
create index expenses_workspace_idx on public.expenses (workspace_id, incurred_on);

-- ---------------------------------------------------------------------------
-- Files (metadata; bytes live in Supabase Storage)
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid,
  project_id uuid,
  name text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  mime_type text not null default 'application/octet-stream',
  storage_path text not null unique,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, workspace_id)
    references public.clients (id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade
);
create index files_client_idx on public.files (client_id);
create index files_project_idx on public.files (project_id);

-- ---------------------------------------------------------------------------
-- Notifications and activity
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, workspace_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, workspace_id) where read_at is null;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_logs_ws_idx on public.activity_logs (workspace_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_id);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan public.plan_tier not null default 'starter',
  status public.subscription_status not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  payment_method_brand text,
  payment_method_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  stripe_invoice_id text unique,
  description text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  status text not null,
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_history_ws_idx on public.billing_history (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'workspaces', 'workspace_members', 'workspace_invitations', 'clients',
    'projects', 'project_members', 'tasks', 'task_comments', 'invoices', 'invoice_items',
    'expenses', 'files', 'notifications', 'activity_logs', 'subscriptions', 'billing_history'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.role_rank(r public.workspace_role)
returns integer
language sql
immutable
as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'member' then 2 else 1 end;
$$;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(ws uuid, min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and public.role_rank(m.role) >= public.role_rank(min_role)
  );
$$;

create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Prevent members from escalating roles or demoting the last owner.
-- Owners cannot be deleted through the API (see the delete policy below), so a
-- workspace keeps an owner until the workspace itself is deleted.
create or replace function public.guard_workspace_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_count integer;
begin
  if auth.uid() is not null and new.role = 'owner' and old.role <> 'owner'
     and not public.has_workspace_role(new.workspace_id, 'owner') then
    raise exception 'Only owners can grant the owner role';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    select count(*) into owner_count from public.workspace_members
      where workspace_id = old.workspace_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'A workspace must keep at least one owner';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_workspace_members
  before update on public.workspace_members
  for each row execute function public.guard_workspace_members();

-- ---------------------------------------------------------------------------
-- Workspace creation, signup bootstrap and invitations
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_workspace(p_user uuid, p_name text, p_industry text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws_id uuid;
  base_slug text;
begin
  base_slug := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g'));
  insert into public.workspaces (name, slug, industry, created_by)
  values (
    coalesce(nullif(trim(p_name), ''), 'My workspace'),
    left(base_slug, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    p_industry,
    p_user
  )
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, p_user, 'owner');

  -- Every new workspace starts with a 14-day Pro trial.
  insert into public.subscriptions (workspace_id, plan, status, trial_end, current_period_end)
  values (ws_id, 'pro', 'trialing', now() + interval '14 days', now() + interval '14 days');

  return ws_id;
end;
$$;
revoke execute on function public.bootstrap_workspace(uuid, text, text) from public, anon, authenticated;

create or replace function public.create_workspace(p_name text, p_industry text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(coalesce(trim(p_name), '')) = 0 or char_length(p_name) > 80 then
    raise exception 'Workspace name must be between 1 and 80 characters';
  end if;
  return public.bootstrap_workspace(auth.uid(), p_name, p_industry);
end;
$$;
grant execute on function public.create_workspace(text, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if coalesce(new.raw_user_meta_data ->> 'workspace_name', '') <> '' then
    perform public.bootstrap_workspace(new.id, new.raw_user_meta_data ->> 'workspace_name');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.workspace_invitations%rowtype;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select email into user_email from auth.users where id = auth.uid();

  select * into inv from public.workspace_invitations
  where token = p_token and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation is invalid or has expired';
  end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations set accepted_at = now() where id = inv.id;
  return inv.workspace_id;
end;
$$;
grant execute on function public.accept_invitation(text) to authenticated;

-- Invitation preview for the accept page (limited columns, token required).
create or replace function public.get_invitation(p_token text)
returns table (workspace_name text, email text, role public.workspace_role, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.email, i.role, i.expires_at <= now(), i.accepted_at is not null
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expenses enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_history enable row level security;

-- Profiles
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces
create policy "workspaces: members read" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces: admins update" on public.workspaces
  for update to authenticated
  using (public.has_workspace_role(id, 'admin'))
  with check (public.has_workspace_role(id, 'admin'));
create policy "workspaces: owners delete" on public.workspaces
  for delete to authenticated using (public.has_workspace_role(id, 'owner'));

-- Membership
create policy "members: members read" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members: admins update roles" on public.workspace_members
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'admin'))
  with check (public.has_workspace_role(workspace_id, 'admin'));
create policy "members: admins remove or self leave" on public.workspace_members
  for delete to authenticated
  using (role <> 'owner' and (public.has_workspace_role(workspace_id, 'admin') or user_id = auth.uid()));

-- Invitations
create policy "invitations: admins read" on public.workspace_invitations
  for select to authenticated using (public.has_workspace_role(workspace_id, 'admin'));
create policy "invitations: admins create" on public.workspace_invitations
  for insert to authenticated with check (public.has_workspace_role(workspace_id, 'admin'));
create policy "invitations: admins delete" on public.workspace_invitations
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

-- Generic tenant tables: members read, members+ write
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'projects', 'project_members', 'tasks', 'invoice_items', 'expenses', 'files']
  loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated
                      using (public.is_workspace_member(workspace_id))', t);
    execute format('create policy "%1$s: contributors insert" on public.%1$I for insert to authenticated
                      with check (public.has_workspace_role(workspace_id, ''member''))', t);
    execute format('create policy "%1$s: contributors update" on public.%1$I for update to authenticated
                      using (public.has_workspace_role(workspace_id, ''member''))
                      with check (public.has_workspace_role(workspace_id, ''member''))', t);
  end loop;
end;
$$;

create policy "clients: admins delete" on public.clients
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));
create policy "projects: admins delete" on public.projects
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));
create policy "project_members: contributors delete" on public.project_members
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'member'));
create policy "tasks: contributors delete" on public.tasks
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'member'));
create policy "invoice_items: contributors delete" on public.invoice_items
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'member'));
create policy "expenses: admins delete" on public.expenses
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));
create policy "files: contributors delete" on public.files
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'member'));

-- Invoices: only drafts may be deleted
create policy "invoices: members read" on public.invoices
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "invoices: contributors insert" on public.invoices
  for insert to authenticated with check (public.has_workspace_role(workspace_id, 'member'));
create policy "invoices: contributors update" on public.invoices
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'member'))
  with check (public.has_workspace_role(workspace_id, 'member'));
create policy "invoices: contributors delete drafts" on public.invoices
  for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'member') and status = 'draft');

-- Task comments: authors own their comments
create policy "task_comments: members read" on public.task_comments
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "task_comments: members comment" on public.task_comments
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'member') and author_id = auth.uid());
create policy "task_comments: authors or admins delete" on public.task_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.has_workspace_role(workspace_id, 'admin'));

-- Notifications: private to the recipient
create policy "notifications: recipient reads" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: recipient updates" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: recipient deletes" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
create policy "notifications: teammates notify teammates" on public.notifications
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = notifications.workspace_id and m.user_id = notifications.user_id
    )
  );

-- Activity log: append-only
create policy "activity: members read" on public.activity_logs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "activity: members append as themselves" on public.activity_logs
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

-- Billing: read-only for members; written by the Stripe webhook with the service role
create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "billing_history: admins read" on public.billing_history
  for select to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Private workspace files: <workspace_id>/<entity>/<uuid>-<filename>
insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do nothing;

-- Public avatars and logos: users/<user_id>/... and workspaces/<workspace_id>/...
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

create or replace function public.storage_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "workspace files: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'workspace-files' and public.is_workspace_member(public.storage_workspace_id(name)));
create policy "workspace files: contributors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workspace-files'
    and public.has_workspace_role(public.storage_workspace_id(name), 'member'));
create policy "workspace files: contributors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'workspace-files'
    and public.has_workspace_role(public.storage_workspace_id(name), 'member'));

create policy "public assets: users manage own avatar" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text);

create or replace function public.storage_asset_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if (storage.foldername(object_name))[1] <> 'workspaces' then
    return null;
  end if;
  return (storage.foldername(object_name))[2]::uuid;
exception when others then
  return null;
end;
$$;

create policy "public assets: admins manage workspace logo" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets'
    and public.has_workspace_role(public.storage_asset_workspace_id(name), 'admin'))
  with check (bucket_id = 'public-assets'
    and public.has_workspace_role(public.storage_asset_workspace_id(name), 'admin'));
