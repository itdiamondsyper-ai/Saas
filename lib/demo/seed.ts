import { createHash } from "node:crypto";
import { addDays, startOfMonthUTC, toDateString } from "@/lib/dates";
import type {
  ActivityLogRow,
  BillingHistoryRow,
  ClientRow,
  ClientStatus,
  ExpenseRow,
  FileRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  NotificationRow,
  Priority,
  ProfileRow,
  ProjectMemberRow,
  ProjectRow,
  ProjectStatus,
  SubscriptionRow,
  TaskCommentRow,
  TaskRow,
  TaskStatus,
  Tables,
  WorkspaceInvitationRow,
  WorkspaceMemberRow,
  WorkspaceRole,
  WorkspaceRow,
} from "@/types/database";

// Realistic, deterministic demo data for the "Vertex Creative" workspace.
// All dates are relative to `now`, so the dashboard always looks current.
// The same builder feeds the local demo store and supabase/seed.sql.

export const DEMO_PASSWORD = "demo1234";
export const DEMO_OWNER_EMAIL = "alex@vertex-demo.com";

export interface SeedUser {
  id: string;
  email: string;
  password: string;
}

export interface SeedData {
  users: SeedUser[];
  tables: { [K in keyof Tables]: Tables[K][] };
  /** Demo file contents keyed by storage path. */
  fileContents: Record<string, string>;
}

/** Deterministic UUID derived from a stable key, so re-seeding is idempotent. */
export function seedId(key: string): string {
  const h = createHash("sha1").update(`flowpilot:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSeed(now: Date = new Date()): SeedData {
  const random = rng(42);
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000);
  const day = (offset: number) => toDateString(addDays(now, offset));
  const ts = (d: Date) => ({ created_at: iso(d), updated_at: iso(d) });

  const workspaceId = seedId("workspace:vertex");

  // --- People -------------------------------------------------------------
  const people = [
    { key: "alex", name: "Alex Morgan", email: DEMO_OWNER_EMAIL, role: "owner", title: "Founder & Creative Director" },
    { key: "sarah", name: "Sarah Lee", email: "sarah@vertex-demo.com", role: "admin", title: "Operations Lead" },
    { key: "marcus", name: "Marcus Tan", email: "marcus@vertex-demo.com", role: "member", title: "Senior Developer" },
    { key: "emma", name: "Emma Wilson", email: "emma@vertex-demo.com", role: "member", title: "Product Designer" },
  ] as const;
  type PersonKey = (typeof people)[number]["key"];
  const uid = (key: PersonKey) => seedId(`user:${key}`);

  const profiles: ProfileRow[] = people.map((p, i) => ({
    id: uid(p.key),
    email: p.email,
    full_name: p.name,
    avatar_url: null,
    job_title: p.title,
    notification_prefs: { email: true, invoices: true, tasks: true, weekly_report: p.key === "alex" },
    last_active_at: iso(daysAgo(0, [0.2, 1, 3, 26][i])),
    ...ts(daysAgo(365 - i * 20)),
  }));

  const workspace: WorkspaceRow = {
    id: workspaceId,
    name: "Vertex Creative",
    slug: "vertex-creative",
    logo_url: null,
    industry: "Design & creative agency",
    team_size: "2-10",
    primary_goal: "Manage projects",
    onboarding_completed: true,
    created_by: uid("alex"),
    ...ts(daysAgo(365)),
  };

  const members: WorkspaceMemberRow[] = people.map((p, i) => ({
    id: seedId(`member:${p.key}`),
    workspace_id: workspaceId,
    user_id: uid(p.key),
    role: p.role as WorkspaceRole,
    ...ts(daysAgo(365 - i * 20)),
  }));

  const invitations: WorkspaceInvitationRow[] = [
    {
      id: seedId("invite:jordan"),
      workspace_id: workspaceId,
      email: "jordan@vertex-demo.com",
      role: "member",
      token: createHash("sha256").update("flowpilot-demo-invite-jordan").digest("hex").slice(0, 48),
      invited_by: uid("alex"),
      accepted_at: null,
      expires_at: iso(addDays(now, 12)),
      ...ts(daysAgo(2)),
    },
  ];

  // --- Clients ------------------------------------------------------------
  const clientDefs: {
    key: string;
    company: string;
    contact: string;
    email: string;
    phone: string;
    website: string;
    industry: string;
    status: ClientStatus;
    createdDaysAgo: number;
    tags: string[];
    owner: PersonKey;
    notes: string;
    address: string;
  }[] = [
    {
      key: "northstar", company: "Northstar Studio", contact: "Olivia Chen", email: "olivia@northstar-demo.com",
      phone: "+1 (415) 555-0142", website: "https://northstar-demo.com", industry: "Design studio", status: "active",
      createdDaysAgo: 330, tags: ["retainer", "design", "priority"], owner: "alex",
      address: "88 Market Street, Suite 400, San Francisco, CA 94103",
      notes: "Long-term retainer client. Olivia prefers a Friday status email and a short call every other Monday. Their brand team signs off on all visual work, so build in two review rounds.",
    },
    {
      key: "atlas", company: "Atlas Consulting", contact: "Daniel Brooks", email: "daniel@atlas-demo.com",
      phone: "+1 (312) 555-0187", website: "https://atlas-consulting-demo.com", industry: "Management consulting", status: "active",
      createdDaysAgo: 300, tags: ["branding", "web"], owner: "sarah",
      address: "200 W Madison St, Chicago, IL 60606",
      notes: "Rebranding ahead of their Series B. Daniel is the decision maker; loop in their CFO on budget changes over $2k.",
    },
    {
      key: "lunar", company: "Lunar Creative", contact: "Priya Patel", email: "priya@lunarcreative-demo.com",
      phone: "+1 (646) 555-0119", website: "https://lunarcreative-demo.com", industry: "Media & publishing", status: "active",
      createdDaysAgo: 270, tags: ["mobile", "product"], owner: "marcus",
      address: "45 Bond Street, New York, NY 10012",
      notes: "Building a journaling app for their creator community. Launch date is fixed to their conference, so scope is flexible but the deadline is not.",
    },
    {
      key: "oak", company: "Oak & Co.", contact: "James Whitfield", email: "james@oakandco-demo.com",
      phone: "+1 (503) 555-0164", website: "https://oakandco-demo.com", industry: "Retail", status: "active",
      createdDaysAgo: 210, tags: ["marketing", "seasonal"], owner: "sarah",
      address: "1120 NW Couch St, Portland, OR 97209",
      notes: "Furniture retailer. Busy season is November to January; campaign assets must be approved by mid-October.",
    },
    {
      key: "nova", company: "Nova Labs", contact: "Hannah Kim", email: "hannah@novalabs-demo.com",
      phone: "+1 (206) 555-0175", website: "https://novalabs-demo.com", industry: "B2B SaaS", status: "active",
      createdDaysAgo: 150, tags: ["dashboard", "data"], owner: "marcus",
      address: "500 Union St, Seattle, WA 98101",
      notes: "Analytics product team. They provide a staging API and expect weekly demos on Thursdays.",
    },
    {
      key: "brightline", company: "Brightline Fitness", contact: "Carlos Rivera", email: "carlos@brightline-demo.com",
      phone: "+1 (305) 555-0133", website: "https://brightline-demo.com", industry: "Health & fitness", status: "inactive",
      createdDaysAgo: 320, tags: ["mobile"], owner: "emma",
      address: "1450 Brickell Ave, Miami, FL 33131",
      notes: "Onboarding redesign paused while they renegotiate funding. Follow up next quarter.",
    },
    {
      key: "harbor", company: "Harbor & Pine", contact: "Grace Thompson", email: "grace@harborpine-demo.com",
      phone: "+1 (617) 555-0158", website: "https://harborpine-demo.com", industry: "Hospitality", status: "active",
      createdDaysAgo: 180, tags: ["web", "booking"], owner: "emma",
      address: "12 Seaport Blvd, Boston, MA 02210",
      notes: "Restaurant group with three locations. Very happy with the booking site, potential referral source.",
    },
    {
      key: "meridian", company: "Meridian Health", contact: "Samuel Okafor", email: "samuel@meridianhealth-demo.com",
      phone: "+1 (512) 555-0191", website: "https://meridianhealth-demo.com", industry: "Healthcare", status: "lead",
      createdDaysAgo: 28, tags: ["inbound"], owner: "alex",
      address: "301 Congress Ave, Austin, TX 78701",
      notes: "Inbound lead from the website. Interested in a patient portal redesign; needs HIPAA-aware vendors.",
    },
    {
      key: "sable", company: "Sable Architecture", contact: "Lena Fischer", email: "lena@sable-demo.com",
      phone: "+1 (303) 555-0127", website: "https://sable-demo.com", industry: "Architecture", status: "active",
      createdDaysAgo: 120, tags: ["web", "portfolio"], owner: "emma",
      address: "1600 Wynkoop St, Denver, CO 80202",
      notes: "Portfolio site to showcase residential work. Photography is supplied by their in-house team.",
    },
    {
      key: "juniper", company: "Juniper Foods", contact: "Tom Reyes", email: "tom@juniperfoods-demo.com",
      phone: "+1 (619) 555-0108", website: "https://juniperfoods-demo.com", industry: "Food & beverage", status: "lead",
      createdDaysAgo: 9, tags: ["referral"], owner: "marcus",
      address: "750 B Street, San Diego, CA 92101",
      notes: "Referred by Harbor & Pine. Wants packaging and a Shopify refresh before spring.",
    },
    {
      key: "polaris", company: "Polaris Ventures", contact: "Aisha Rahman", email: "aisha@polaris-demo.com",
      phone: "+1 (650) 555-0170", website: "https://polaris-demo.com", industry: "Venture capital", status: "archived",
      createdDaysAgo: 345, tags: ["one-off"], owner: "alex",
      address: "2882 Sand Hill Rd, Menlo Park, CA 94025",
      notes: "One-off pitch deck project last year. Archived after completion.",
    },
    {
      key: "cobalt", company: "Cobalt Robotics", contact: "Ethan Park", email: "ethan@cobalt-demo.com",
      phone: "+1 (408) 555-0149", website: "https://cobalt-robotics-demo.com", industry: "Hardware", status: "active",
      createdDaysAgo: 60, tags: ["launch", "marketing"], owner: "alex",
      address: "99 S Almaden Blvd, San Jose, CA 95113",
      notes: "Hardware launch in Q1. Needs a launch kit: landing page, product video storyboard, and press assets.",
    },
    {
      key: "redwood", company: "Redwood Legal", contact: "Naomi Grant", email: "naomi@redwoodlegal-demo.com",
      phone: "+1 (916) 555-0112", website: "https://redwoodlegal-demo.com", industry: "Legal services", status: "lead",
      createdDaysAgo: 20, tags: ["inbound"], owner: "sarah",
      address: "400 Capitol Mall, Sacramento, CA 95814",
      notes: "Requested a proposal for a website refresh and client intake form.",
    },
  ];
  const cid = (key: string) => seedId(`client:${key}`);
  const clients: ClientRow[] = clientDefs.map((c) => ({
    id: cid(c.key),
    workspace_id: workspaceId,
    company: c.company,
    contact_name: c.contact,
    email: c.email,
    phone: c.phone,
    website: c.website,
    industry: c.industry,
    address: c.address,
    status: c.status,
    tags: c.tags,
    notes: c.notes,
    owner_id: uid(c.owner),
    last_activity_at: iso(daysAgo(Math.min(c.createdDaysAgo, c.status === "active" ? 2 : 40))),
    ...ts(daysAgo(c.createdDaysAgo)),
  }));
  const clientCreated = Object.fromEntries(clientDefs.map((c) => [c.key, c.createdDaysAgo]));

  // --- Projects -----------------------------------------------------------
  const projectDefs: {
    key: string;
    name: string;
    client: string;
    owner: PersonKey;
    status: ProjectStatus;
    priority: Priority;
    start: number;
    due: number;
    budget: number;
    members: PersonKey[];
    description: string;
    progress?: number;
  }[] = [
    {
      key: "northstar-web", name: "Northstar Website Redesign", client: "northstar", owner: "sarah", status: "active",
      priority: "high", start: -60, due: 18, budget: 18000, members: ["sarah", "emma", "marcus"],
      description: "Full redesign of northstar-demo.com with a new CMS, case study templates and a faster, accessible front end.",
    },
    {
      key: "northstar-marketing", name: "Northstar Marketing Campaign", client: "northstar", owner: "alex", status: "completed",
      priority: "medium", start: -200, due: -120, budget: 9500, members: ["alex", "sarah", "emma"],
      description: "Spring launch campaign: email nurture sequence, paid social creative and a campaign landing page.",
    },
    {
      key: "atlas-brand", name: "Atlas Brand Refresh", client: "atlas", owner: "emma", status: "active",
      priority: "high", start: -45, due: 5, budget: 12000, members: ["emma", "sarah", "alex"],
      description: "New visual identity, brand guidelines and stationery system ahead of Atlas Consulting's Series B announcement.",
    },
    {
      key: "atlas-web", name: "Atlas Website", client: "atlas", owner: "marcus", status: "in_review",
      priority: "medium", start: -20, due: 40, budget: 14000, members: ["marcus", "emma", "sarah"],
      description: "Marketing site rebuilt on the new brand, with service pages, case studies and a booking flow for discovery calls.",
    },
    {
      key: "lunar-app", name: "Lunar Mobile App", client: "lunar", owner: "marcus", status: "active",
      priority: "urgent", start: -90, due: 3, budget: 32000, members: ["marcus", "emma", "sarah"],
      description: "iOS and Android journaling app for Lunar's creator community, with offline sync and push reminders.",
    },
    {
      key: "oak-campaign", name: "Oak Marketing Campaign", client: "oak", owner: "sarah", status: "planning",
      priority: "medium", start: 3, due: 60, budget: 7500, members: ["sarah", "emma", "alex"],
      description: "Holiday season campaign across Instagram, email and in-store signage for Oak & Co.'s new collection.",
    },
    {
      key: "nova-dashboard", name: "Nova Analytics Dashboard", client: "nova", owner: "marcus", status: "active",
      priority: "high", start: -30, due: 45, budget: 22000, members: ["marcus", "emma", "alex"],
      description: "Customer-facing analytics dashboard with cohort retention, usage reports and role-based access.",
    },
    {
      key: "harbor-booking", name: "Harbor & Pine Booking Site", client: "harbor", owner: "emma", status: "completed",
      priority: "medium", start: -150, due: -70, budget: 11000, members: ["emma", "marcus"],
      description: "Reservation and events website for three restaurant locations, integrated with their booking provider.",
    },
    {
      key: "brightline-onboarding", name: "Brightline App Onboarding", client: "brightline", owner: "emma", status: "on_hold",
      priority: "low", start: -110, due: 20, budget: 6000, members: ["emma"], progress: 35,
      description: "Redesign of the first-run experience in the Brightline Fitness app to improve trial conversion.",
    },
    {
      key: "sable-portfolio", name: "Sable Portfolio Website", client: "sable", owner: "emma", status: "active",
      priority: "medium", start: -15, due: 30, budget: 8000, members: ["emma", "sarah"],
      description: "Image-led portfolio site for Sable Architecture's residential projects.",
    },
    {
      key: "cobalt-launch", name: "Cobalt Product Launch Kit", client: "cobalt", owner: "alex", status: "planning",
      priority: "high", start: 7, due: 50, budget: 9000, members: ["alex", "emma", "marcus"],
      description: "Launch landing page, product video storyboard and press kit for Cobalt's first robot.",
    },
  ];
  const pid = (key: string) => seedId(`project:${key}`);

  // --- Tasks --------------------------------------------------------------
  type TaskDef = [project: string | null, title: string, status: TaskStatus, priority: Priority, assignee: PersonKey, due: number, labels: string[], description?: string];
  const taskDefs: TaskDef[] = [
    ["northstar-web", "Design Homepage", "done", "high", "sarah", -10, ["design"], "Hero, feature grid and testimonial layouts for desktop and mobile, signed off by Olivia."],
    ["northstar-web", "Stakeholder interviews", "done", "medium", "alex", -45, ["research"], "Six interviews with Northstar's leadership and two long-time clients."],
    ["northstar-web", "Information architecture & sitemap", "done", "medium", "emma", -35, ["design"]],
    ["northstar-web", "Build CMS content models", "in_progress", "high", "marcus", 4, ["development"], "Case studies, team members, services and blog posts with reusable content blocks."],
    ["northstar-web", "Responsive navigation component", "review", "medium", "marcus", 2, ["development"]],
    ["northstar-web", "Write case study copy", "todo", "medium", "sarah", 7, ["content"], "Three flagship case studies, about 600 words each, using notes from the interviews."],
    ["northstar-web", "Accessibility audit", "todo", "high", "emma", 12, ["qa"], "WCAG 2.1 AA review of templates, focus states and color contrast."],
    ["northstar-web", "Launch checklist & DNS cutover", "backlog", "urgent", "marcus", 18, ["launch"]],
    ["northstar-marketing", "Launch email sequence", "done", "medium", "sarah", -150, ["marketing"]],
    ["northstar-marketing", "Paid social creative", "done", "medium", "emma", -140, ["design"]],
    ["northstar-marketing", "Campaign performance report", "done", "low", "alex", -122, ["reporting"]],
    ["atlas-brand", "Competitive brand audit", "done", "medium", "emma", -30, ["research"]],
    ["atlas-brand", "Logo concepts round 2", "done", "high", "emma", -12, ["design"]],
    ["atlas-brand", "Brand guidelines document", "in_progress", "high", "emma", 3, ["design"], "Logo usage, color, typography, photography direction and tone of voice."],
    ["atlas-brand", "Stationery mockups", "todo", "low", "sarah", 6, ["design"]],
    ["atlas-brand", "Present final identity to Atlas board", "todo", "urgent", "alex", 5, ["client"]],
    ["atlas-web", "Wireframes for service pages", "done", "medium", "marcus", -8, ["design"]],
    ["atlas-web", "Develop contact & booking forms", "review", "high", "marcus", 1, ["development"]],
    ["atlas-web", "SEO metadata pass", "todo", "medium", "sarah", 10, ["content"]],
    ["atlas-web", "QA on staging", "in_progress", "medium", "emma", 4, ["qa"]],
    ["lunar-app", "Onboarding flow prototype", "done", "medium", "emma", -40, ["design"]],
    ["lunar-app", "Push notification service", "in_progress", "urgent", "marcus", -2, ["backend"], "Daily reminder scheduling with per-user time zones and quiet hours."],
    ["lunar-app", "App Store screenshots", "todo", "medium", "emma", 2, ["design"]],
    ["lunar-app", "Offline sync for journal entries", "in_progress", "high", "marcus", 3, ["backend"]],
    ["lunar-app", "Beta tester feedback triage", "backlog", "medium", "sarah", 6, ["research"]],
    ["lunar-app", "Crash reporting setup", "todo", "high", "marcus", -1, ["backend"]],
    ["lunar-app", "Payment paywall integration", "backlog", "high", "marcus", 10, ["backend"]],
    ["oak-campaign", "Campaign brief & KPIs", "in_progress", "medium", "sarah", 4, ["planning"]],
    ["oak-campaign", "Holiday social content calendar", "backlog", "medium", "emma", 20, ["marketing"]],
    ["oak-campaign", "Influencer shortlist", "backlog", "low", "alex", 25, ["marketing"]],
    ["nova-dashboard", "Data model review with Nova engineers", "done", "medium", "marcus", -20, ["development"]],
    ["nova-dashboard", "Chart component library", "done", "high", "emma", -6, ["design", "development"]],
    ["nova-dashboard", "Cohort retention view", "in_progress", "high", "marcus", 6, ["development"]],
    ["nova-dashboard", "Role-based access controls", "todo", "high", "marcus", 14, ["development", "security"]],
    ["nova-dashboard", "Usage-based billing report", "backlog", "medium", "alex", 30, ["reporting"]],
    ["nova-dashboard", "Dashboard performance profiling", "todo", "medium", "marcus", 9, ["development"]],
    ["harbor-booking", "Booking widget integration", "done", "high", "marcus", -85, ["development"]],
    ["harbor-booking", "Menu & events CMS", "done", "medium", "emma", -75, ["development"]],
    ["brightline-onboarding", "Onboarding UX research", "done", "medium", "emma", -95, ["research"]],
    ["brightline-onboarding", "Revised onboarding screens", "backlog", "low", "emma", 20, ["design"]],
    ["sable-portfolio", "Photography shot list", "done", "medium", "emma", -5, ["planning"]],
    ["sable-portfolio", "Project gallery layout", "in_progress", "medium", "emma", 5, ["design"]],
    ["sable-portfolio", "Copy edits from Lena", "todo", "low", "sarah", 8, ["content"]],
    ["cobalt-launch", "Kickoff workshop", "todo", "high", "alex", 7, ["client"]],
    ["cobalt-launch", "Launch video storyboard", "backlog", "medium", "emma", 21, ["design"]],
    [null, "Quarterly tax filing prep", "todo", "medium", "alex", 9, ["admin"], "Collect receipts and export the invoice report for the accountant."],
    [null, "Renew design software licenses", "todo", "low", "sarah", 2, ["admin"]],
  ];

  const statusOrder: Record<TaskStatus, number> = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4 };
  const positionCounter: Record<TaskStatus, number> = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 };
  const tasks: TaskRow[] = taskDefs.map(([project, title, status, priority, assignee, due, labels, description], i) => {
    const pdef = projectDefs.find((p) => p.key === project);
    const createdOffset = pdef ? Math.max(-pdef.start, 1) : 14;
    const created = daysAgo(Math.max(createdOffset - (i % 5), 1));
    const completed = status === "done" ? (title === "Design Homepage" ? daysAgo(0, 0.4) : daysAgo(Math.max(-due - 1, 0), 3)) : null;
    positionCounter[status] += 1;
    return {
      id: seedId(`task:${i}`),
      workspace_id: workspaceId,
      project_id: project ? pid(project) : null,
      assignee_id: uid(assignee),
      created_by: uid(pdef?.owner ?? "alex"),
      title,
      description: description ?? null,
      status,
      priority,
      due_date: day(due),
      labels,
      position: positionCounter[status] * 1000 + statusOrder[status],
      completed_at: completed ? iso(completed) : null,
      created_at: iso(created),
      updated_at: iso(completed ?? created),
    };
  });

  const projects: ProjectRow[] = projectDefs.map((p) => {
    const projectTasks = tasks.filter((t) => t.project_id === pid(p.key));
    const done = projectTasks.filter((t) => t.status === "done").length;
    const progress =
      p.progress ?? (p.status === "completed" ? 100 : projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0);
    const created = daysAgo(Math.max(-p.start + 5, 2));
    return {
      id: pid(p.key),
      workspace_id: workspaceId,
      client_id: cid(p.client),
      owner_id: uid(p.owner),
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      start_date: day(p.start),
      due_date: day(p.due),
      progress,
      budget: p.budget,
      ...ts(created),
    };
  });

  const projectMembers: ProjectMemberRow[] = projectDefs.flatMap((p) =>
    p.members.map((m) => ({ project_id: pid(p.key), user_id: uid(m), workspace_id: workspaceId, ...ts(daysAgo(Math.max(-p.start, 1))) })),
  );

  const comments: TaskCommentRow[] = [
    [3, "marcus", "Content models are in. Case studies support galleries and pull quotes now.", 1],
    [3, "sarah", "Great. Can we add an optional client logo field? Olivia asked about it on Monday.", 0.6],
    [21, "marcus", "Reminders work on iOS. Android needs exact alarms permission handling, finishing today.", 0.3],
    [21, "alex", "Thanks Marcus. Priya wants a demo build on Thursday, let me know if that is at risk.", 0.2],
    [13, "emma", "First draft of the guidelines is uploaded. Typography section still needs the web font specs.", 2],
    [0, "alex", "Olivia loved the hero animation. Approved for build.", 0.5],
  ].map(([taskIndex, author, body, ago], i) => ({
    id: seedId(`comment:${i}`),
    workspace_id: workspaceId,
    task_id: tasks[taskIndex as number].id,
    author_id: uid(author as PersonKey),
    body: body as string,
    ...ts(daysAgo(ago as number)),
  }));

  // --- Invoices -----------------------------------------------------------
  // Paid revenue (excluding tax) per calendar month, oldest first; the last value is this month.
  const monthlyRevenue = [9850, 11200, 10450, 12900, 13650, 12300, 14800, 15250, 14100, 15780, 16390, 18420];
  const northstarByMonth: Record<number, { amount: number; project: string | null; label: string }> = {
    [-10]: { amount: 3200, project: null, label: "Brand design retainer" },
    [-6]: { amount: 4800, project: "northstar-marketing", label: "Campaign creative and landing page" },
    [-4]: { amount: 4700, project: "northstar-marketing", label: "Email sequence and campaign reporting" },
    [-1]: { amount: 5600, project: "northstar-web", label: "Website redesign discovery and UX" },
    [0]: { amount: 6500, project: "northstar-web", label: "Website redesign design milestone" },
  };
  const rotation = ["atlas", "lunar", "harbor", "oak", "nova", "brightline", "sable", "cobalt", "polaris"];
  const clientProject: Record<string, string> = {
    atlas: "atlas-brand", lunar: "lunar-app", harbor: "harbor-booking", oak: "oak-campaign", nova: "nova-dashboard",
    brightline: "brightline-onboarding", sable: "sable-portfolio", cobalt: "cobalt-launch",
  };
  const serviceLines: Record<string, [string, number][]> = {
    atlas: [["Brand strategy workshop", 150], ["Identity design", 135]],
    lunar: [["Mobile app development", 140], ["UX design", 120]],
    harbor: [["Website development", 120], ["Booking integration", 130]],
    oak: [["Campaign strategy", 125], ["Social content production", 95]],
    nova: [["Dashboard engineering", 145], ["Data visualization design", 125]],
    brightline: [["UX research", 115], ["Interface design", 120]],
    sable: [["Website design", 120], ["Front-end development", 125]],
    cobalt: [["Launch strategy", 150], ["Landing page design", 120]],
    polaris: [["Pitch deck design", 130], ["Copywriting", 95]],
    northstar: [["Design services", 120], ["Project management", 95]],
  };

  type InvoiceDraft = {
    client: string;
    project: string | null;
    subtotal: number;
    taxRate: number;
    status: InvoiceStatus;
    issue: Date;
    due: Date;
    paid: Date | null;
    sent: Date | null;
    label: string;
    items?: { description: string; quantity: number; unit_price: number }[];
    notes?: string;
  };
  const drafts: InvoiceDraft[] = [];
  const monthStart = (offset: number) => startOfMonthUTC(now, offset);

  for (let i = 0; i < 12; i++) {
    const offset = i - 11;
    const start = monthStart(offset);
    const end = offset === 0 ? now : monthStart(offset + 1);
    const span = end.getTime() - start.getTime();
    const at = (fraction: number) => new Date(start.getTime() + span * fraction);
    let remaining = monthlyRevenue[i];
    const ns = northstarByMonth[offset];
    const parts: { client: string; amount: number; project: string | null; label?: string }[] = [];
    if (ns) {
      parts.push({ client: "northstar", amount: ns.amount, project: ns.project, label: ns.label });
      remaining -= ns.amount;
    }
    const monthAgeDays = (now.getTime() - start.getTime()) / 86_400_000;
    const engagedUntilDaysAgo: Record<string, number> = { polaris: 250, brightline: 100 };
    const eligible = rotation.filter(
      (key) => clientCreated[key] >= monthAgeDays - 25 && monthAgeDays >= (engagedUntilDaysAgo[key] ?? 0),
    );
    const pool = eligible.length ? eligible : ["atlas"];
    const count = remaining > 9000 ? 3 : 2;
    const picks = Array.from({ length: count }, (_, k) => pool[(i * 2 + k) % pool.length]).filter(
      (v, idx, arr) => arr.indexOf(v) === idx,
    );
    let left = remaining;
    picks.forEach((client, k) => {
      const amount = k === picks.length - 1 ? left : Math.round((remaining / picks.length) * (0.8 + random() * 0.4) / 10) * 10;
      left -= amount;
      parts.push({ client, amount, project: clientProject[client] ?? null });
    });
    parts.forEach((part, k) => {
      const paid = at(Math.min(0.15 + k * 0.27 + random() * 0.1, 0.95));
      const issue = addDays(paid, -(10 + Math.floor(random() * 12)));
      drafts.push({
        client: part.client,
        project: part.project,
        subtotal: part.amount,
        taxRate: part.client === "polaris" ? 0 : 9,
        status: "paid",
        issue,
        due: addDays(issue, 30),
        paid,
        sent: addDays(issue, 0.1),
        label: part.label ?? "",
      });
    });
  }

  // Outstanding, draft and cancelled invoices.
  const extra: (Omit<InvoiceDraft, "issue" | "due" | "paid" | "sent" | "label"> & { issueAgo: number; dueIn: number; label?: string })[] = [
    { client: "lunar", project: "lunar-app", subtotal: 7800, taxRate: 9, status: "sent", issueAgo: 18, dueIn: 12 },
    { client: "nova", project: "nova-dashboard", subtotal: 5500, taxRate: 9, status: "sent", issueAgo: 10, dueIn: 20 },
    { client: "atlas", project: "atlas-brand", subtotal: 4200, taxRate: 9, status: "sent", issueAgo: 22, dueIn: 8 },
    {
      client: "harbor", project: "harbor-booking", subtotal: 2700, taxRate: 9, status: "overdue", issueAgo: 36, dueIn: -6,
      items: [
        { description: "Website Design", quantity: 20, unit_price: 120 },
        { description: "Hosting Setup", quantity: 1, unit_price: 300 },
      ],
      notes: "Final phase: seasonal menu pages and hosting migration.",
    },
    { client: "brightline", project: "brightline-onboarding", subtotal: 1650, taxRate: 9, status: "overdue", issueAgo: 51, dueIn: -21 },
    { client: "cobalt", project: "cobalt-launch", subtotal: 3600, taxRate: 9, status: "draft", issueAgo: 1, dueIn: 29 },
    { client: "sable", project: "sable-portfolio", subtotal: 2800, taxRate: 9, status: "draft", issueAgo: 0, dueIn: 30 },
    { client: "polaris", project: null, subtotal: 1200, taxRate: 0, status: "cancelled", issueAgo: 300, dueIn: -270 },
  ];
  for (const e of extra) {
    const issue = daysAgo(e.issueAgo);
    drafts.push({
      ...e,
      issue,
      due: addDays(now, e.dueIn),
      paid: null,
      sent: e.status === "draft" ? null : addDays(issue, 0.1),
      label: e.label ?? "",
    });
  }

  drafts.sort((a, b) => a.issue.getTime() - b.issue.getTime());
  const lastPaidIndex = drafts.reduce((acc, d, i) => (d.status === "paid" && (acc < 0 || d.paid! > drafts[acc].paid!) ? i : acc), -1);
  const firstNumber = 1042 - lastPaidIndex;

  const invoices: InvoiceRow[] = [];
  const invoiceItems: InvoiceItemRow[] = [];
  drafts.forEach((d, i) => {
    const id = seedId(`invoice:${i}`);
    const tax = round2((d.subtotal * d.taxRate) / 100);
    const created = d.issue;
    invoices.push({
      id,
      workspace_id: workspaceId,
      client_id: cid(d.client),
      project_id: d.project ? pid(d.project) : null,
      number: `INV-${firstNumber + i}`,
      status: d.status,
      issue_date: toDateString(d.issue),
      due_date: toDateString(d.due),
      subtotal: d.subtotal,
      tax_rate: d.taxRate,
      tax,
      total: round2(d.subtotal + tax),
      currency: "USD",
      notes: d.notes ?? "Thank you for your business. Payment is due within 30 days by bank transfer or card.",
      sent_at: d.sent ? iso(d.sent) : null,
      paid_at: d.paid ? iso(d.paid) : null,
      created_by: uid(i % 3 === 0 ? "sarah" : "alex"),
      created_at: iso(created),
      updated_at: iso(d.paid ?? d.sent ?? created),
    });
    const lines = d.items ?? (() => {
      const [[primary, rate], [secondary]] = serviceLines[d.client];
      const hours = Math.max(1, Math.floor((d.subtotal * 0.7) / rate));
      const first = hours * rate;
      const rest = d.subtotal - first;
      const result = [{ description: d.label || primary, quantity: hours, unit_price: rate }];
      if (rest > 0) result.push({ description: secondary, quantity: 1, unit_price: rest });
      return result;
    })();
    lines.forEach((line, position) => {
      invoiceItems.push({
        id: seedId(`invoice-item:${i}:${position}`),
        workspace_id: workspaceId,
        invoice_id: id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: round2(line.quantity * line.unit_price),
        position,
        ...ts(created),
      });
    });
  });

  // --- Expenses -----------------------------------------------------------
  const expenses: ExpenseRow[] = [];
  for (let i = 0; i < 12; i++) {
    const offset = i - 11;
    const start = monthStart(offset);
    const end = offset === 0 ? now : monthStart(offset + 1);
    const at = (f: number) => new Date(start.getTime() + (end.getTime() - start.getTime()) * f);
    const monthProjects = invoices.filter((inv) => inv.paid_at && new Date(inv.paid_at) >= start && new Date(inv.paid_at) < end && inv.project_id);
    expenses.push({
      id: seedId(`expense:software:${i}`), workspace_id: workspaceId, project_id: null,
      description: "Design & development software subscriptions", category: "software",
      amount: 640, incurred_on: toDateString(at(0.05)), created_by: uid("sarah"), ...ts(at(0.05)),
    });
    expenses.push({
      id: seedId(`expense:rent:${i}`), workspace_id: workspaceId, project_id: null,
      description: "Studio co-working membership", category: "office",
      amount: 1200, incurred_on: toDateString(at(0.08)), created_by: uid("sarah"), ...ts(at(0.08)),
    });
    monthProjects.forEach((inv, k) => {
      const amount = Math.round(inv.subtotal * (0.14 + random() * 0.12) / 10) * 10;
      expenses.push({
        id: seedId(`expense:project:${i}:${k}`), workspace_id: workspaceId, project_id: inv.project_id,
        description: ["Freelance copywriter", "Stock photography license", "Contract illustrator", "QA device lab"][k % 4],
        category: "contractors", amount, incurred_on: toDateString(at(0.3 + k * 0.15)), created_by: uid("sarah"),
        ...ts(at(0.3 + k * 0.15)),
      });
    });
  }

  // --- Files --------------------------------------------------------------
  const fileContents: Record<string, string> = {};
  const fileDefs = [
    { key: "scope", name: "Website-Redesign-Scope.md", client: "northstar", project: "northstar-web", mime: "text/markdown", by: "sarah", ago: 58,
      body: "# Northstar Website Redesign: Scope\n\n## Goals\n- Faster, accessible marketing site\n- New case study templates\n- Editable CMS for the Northstar team\n\n## Milestones\n1. Discovery & UX\n2. Visual design\n3. Build & content migration\n4. Launch\n" },
    { key: "brand-notes", name: "Northstar-Brand-Notes.txt", client: "northstar", project: null, mime: "text/plain", by: "alex", ago: 120,
      body: "Primary color: deep navy. Accent: warm coral. Typeface: a geometric sans for headings.\nAvoid stock photography of handshakes.\n" },
    { key: "atlas-feedback", name: "Atlas-Logo-Feedback.md", client: "atlas", project: "atlas-brand", mime: "text/markdown", by: "emma", ago: 11,
      body: "# Logo round 2 feedback\n\n- Prefer concept B with the compass mark\n- Explore a heavier weight for the wordmark\n- Check legibility at 16px favicon size\n" },
    { key: "nova-metrics", name: "Nova-Metrics-Export.csv", client: "nova", project: "nova-dashboard", mime: "text/csv", by: "marcus", ago: 19,
      body: "metric,definition\nweekly_active_users,Unique users with a session in the last 7 days\nretention_d30,Share of a signup cohort active on day 30\n" },
  ];
  const files: FileRow[] = fileDefs.map((f) => {
    const id = seedId(`file:${f.key}`);
    const path = `${workspaceId}/${f.project ? "projects" : "clients"}/${id}-${f.name}`;
    fileContents[path] = f.body;
    return {
      id,
      workspace_id: workspaceId,
      client_id: cid(f.client),
      project_id: f.project ? pid(f.project) : null,
      name: f.name,
      size_bytes: Buffer.byteLength(f.body),
      mime_type: f.mime,
      storage_path: path,
      uploaded_by: uid(f.by as PersonKey),
      ...ts(daysAgo(f.ago)),
    };
  });

  // --- Activity log -------------------------------------------------------
  const activity: ActivityLogRow[] = [];
  const log = (
    at: Date,
    actor: PersonKey,
    action: string,
    entityType: string,
    entityId: string | null,
    entityName: string,
    metadata: Record<string, unknown> = {},
  ) =>
    activity.push({
      id: seedId(`activity:${activity.length}`),
      workspace_id: workspaceId,
      actor_id: uid(actor),
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      metadata,
      ...ts(at),
    });

  const clientAddedBy: Record<string, PersonKey> = { northstar: "marcus", juniper: "marcus" };
  clientDefs.forEach((c) =>
    log(daysAgo(c.createdDaysAgo), clientAddedBy[c.key] ?? c.owner, "client.created", "client", cid(c.key), c.company),
  );
  projects.forEach((p) => log(new Date(p.created_at), projectDefs.find((d) => pid(d.key) === p.id)!.owner, "project.created", "project", p.id, p.name));
  tasks.filter((t) => t.completed_at).forEach((t) => log(new Date(t.completed_at!), (people.find((p) => uid(p.key) === t.assignee_id)?.key ?? "alex") as PersonKey, "task.completed", "task", t.id, t.title));
  invoices.forEach((inv) => {
    if (inv.sent_at) log(new Date(inv.sent_at), "sarah", "invoice.sent", "invoice", inv.id, inv.number);
    if (inv.paid_at) log(new Date(inv.paid_at), "sarah", "invoice.paid", "invoice", inv.id, inv.number, { amount: inv.total });
  });
  log(daysAgo(0, 3), "marcus", "project.status_changed", "project", pid("atlas-web"), "Atlas Website", { from: "active", to: "in_review" });
  log(daysAgo(2), "alex", "member.invited", "member", null, "jordan@vertex-demo.com", { role: "member" });
  log(daysAgo(6), "alex", "settings.updated", "workspace", workspaceId, "Vertex Creative", { fields: ["industry"] });
  log(daysAgo(0.6), "sarah", "comment.added", "task", tasks[3].id, tasks[3].title);
  log(daysAgo(19), "marcus", "file.uploaded", "file", files[3].id, files[3].name);
  activity.sort((a, b) => a.created_at.localeCompare(b.created_at));

  // --- Notifications ------------------------------------------------------
  const lastPaid = invoices.filter((i) => i.paid_at).sort((a, b) => b.paid_at!.localeCompare(a.paid_at!))[0];
  const notificationDefs: [PersonKey, string, string, string, string, number, boolean][] = [
    ["alex", "invoice_paid", `Invoice ${lastPaid.number} was paid`, `${clients.find((c) => c.id === lastPaid.client_id)!.company} paid $${lastPaid.total.toLocaleString("en-US")}.`, `/dashboard/invoices/${lastPaid.id}`, 0.08, false],
    ["alex", "task_overdue", "Task overdue: Push notification service", "Lunar Mobile App · assigned to Marcus Tan", "/dashboard/tasks", 0.4, false],
    ["alex", "project_deadline", "Lunar Mobile App is due in 3 days", "Progress is at 14%. Consider adjusting scope with Priya.", `/dashboard/projects/${pid("lunar-app")}`, 0.9, false],
    ["alex", "task_assigned", "You were assigned: Present final identity to Atlas board", "Atlas Brand Refresh · due in 5 days", "/dashboard/tasks", 1.5, true],
    ["alex", "member_invited", "Invitation sent to jordan@vertex-demo.com", "Jordan will join as a Member once they accept.", "/dashboard/team", 2, true],
    ["alex", "client_added", "New client: Juniper Foods", "Marcus added Juniper Foods as a lead.", `/dashboard/clients/${cid("juniper")}`, 9, true],
    ["sarah", "task_assigned", "You were assigned: Write case study copy", "Northstar Website Redesign · due in 7 days", "/dashboard/tasks", 1, false],
    ["marcus", "task_overdue", "Task overdue: Crash reporting setup", "Lunar Mobile App", "/dashboard/tasks", 0.5, false],
    ["emma", "task_assigned", "You were assigned: Accessibility audit", "Northstar Website Redesign", "/dashboard/tasks", 3, false],
  ];
  const notifications: NotificationRow[] = notificationDefs.map(([user, type, title, body, link, ago, read], i) => ({
    id: seedId(`notification:${i}`),
    workspace_id: workspaceId,
    user_id: uid(user),
    type,
    title,
    body,
    link,
    read_at: read ? iso(daysAgo(ago * 0.5)) : null,
    ...ts(daysAgo(ago)),
  }));

  // --- Billing ------------------------------------------------------------
  const subscription: SubscriptionRow = {
    id: seedId("subscription:vertex"),
    workspace_id: workspaceId,
    plan: "pro",
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_end: iso(addDays(now, 18)),
    trial_end: null,
    cancel_at_period_end: false,
    payment_method_brand: "visa",
    payment_method_last4: "4242",
    ...ts(daysAgo(300)),
  };
  const billingHistory: BillingHistoryRow[] = Array.from({ length: 6 }, (_, i) => {
    const at = addDays(now, 18 - 30 * (i + 1));
    return {
      id: seedId(`billing:${i}`),
      workspace_id: workspaceId,
      stripe_invoice_id: null,
      description: "FlowPilot Pro · monthly",
      amount: 19,
      currency: "USD",
      status: "paid",
      invoice_url: null,
      ...ts(at),
    };
  });

  return {
    users: people.map((p) => ({ id: uid(p.key), email: p.email, password: DEMO_PASSWORD })),
    tables: {
      profiles,
      workspaces: [workspace],
      workspace_members: members,
      workspace_invitations: invitations,
      clients,
      projects,
      project_members: projectMembers,
      tasks,
      task_comments: comments,
      invoices,
      invoice_items: invoiceItems,
      expenses,
      files,
      notifications,
      activity_logs: activity,
      subscriptions: [subscription],
      billing_history: billingHistory,
    },
    fileContents,
  };
}
