"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Activity, Check, Copy, Loader2, MailPlus, MoreHorizontal, Trash2, UserMinus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { changeRoleAction, inviteMemberAction, memberActivityAction, removeMemberAction, revokeInvitationAction } from "@/lib/actions/account";
import { formatRelative } from "@/lib/format";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { ActivityItem } from "@/lib/services/activity";
import { inviteSchema } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types/database";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl: string | null;
  jobTitle: string | null;
  lastActiveAt: string | null;
  projects: { id: string; name: string }[];
  openTasks: number;
  completedTasks: number;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
  expired: boolean;
  link: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Invite link copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the link and copy it manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />} Copy link
    </Button>
  );
}

export function TeamView({
  members,
  invitations,
  seats,
  currentUserId,
  currentRole,
  canManage,
}: {
  members: TeamMember[];
  invitations: PendingInvite[];
  seats: { used: number; limit: number | null };
  currentUserId: string;
  currentRole: WorkspaceRole;
  canManage: boolean;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [activityFor, setActivityFor] = useState<TeamMember | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const form = useForm<z.input<typeof inviteSchema>, unknown, z.output<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });
  const inviteRoleValue = useWatch({ control: form.control, name: "role" });
  const seatsFull = seats.limit !== null && seats.used >= seats.limit;

  const canEditRole = (m: TeamMember) =>
    canManage && m.userId !== currentUserId && (currentRole === "owner" || (m.role !== "owner" && m.role !== "admin"));

  const showActivity = async (m: TeamMember) => {
    setActivityFor(m);
    setActivity(null);
    const r = await memberActivityAction({ userId: m.userId });
    setActivity(r.ok ? r.data : []);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular">{seats.used}</span> of{" "}
          {seats.limit !== null ? <span className="tabular">{seats.limit}</span> : "unlimited"} seats used (members and pending invites)
        </p>
        {canManage && (
          <Button
            onClick={() => {
              form.reset({ email: "", role: "member" });
              setInviteLink(null);
              setError(null);
              setInviteOpen(true);
            }}
          >
            <MailPlus /> Invite member
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Projects</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Open tasks</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Last active</th>
                <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.userId}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <UserAvatar name={m.name} src={m.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {m.name} {m.userId === currentUserId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEditRole(m) ? (
                      <NativeSelect
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        className="w-32"
                        onChange={async (e) => {
                          const role = e.target.value as WorkspaceRole;
                          const r = await run(() => changeRoleAction({ userId: m.userId, role }), { success: `${m.name} is now ${ROLE_LABELS[role]}` });
                          if (r.ok) router.refresh();
                        }}
                      >
                        {(["owner", "admin", "member", "viewer"] as WorkspaceRole[])
                          .filter((r) => currentRole === "owner" || r !== "owner")
                          .map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                      </NativeSelect>
                    ) : (
                      <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                    )}
                  </td>
                  <td className="max-w-56 px-4 py-3">
                    <span className="line-clamp-2 text-xs text-muted-foreground">{m.projects.length ? m.projects.map((p) => p.name).join(", ") : "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular">{m.openTasks}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatRelative(m.lastActiveAt)}</td>
                  <td className="px-2 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`} />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => showActivity(m)}>
                          <Activity /> View activity
                        </DropdownMenuItem>
                        {canEditRole(m) && m.role !== "owner" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(m)}>
                              <UserMinus /> Remove from workspace
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Pending invitations</h2>
          {invitations.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{i.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABELS[i.role]} · invited {formatRelative(i.created_at)}
                      {i.expired && <span className="text-destructive"> · expired</span>}
                    </span>
                  </span>
                  <div className="flex gap-2">
                    {!i.expired && <CopyButton value={i.link} label={`Copy invite link for ${i.email}`} />}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const r = await run(() => revokeInvitationAction({ id: i.id }), { success: "Invitation revoked" });
                        if (r.ok) router.refresh();
                      }}
                    >
                      <Trash2 /> Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UsersRound} title="No pending invitations" compact />
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["owner", "admin", "member", "viewer"] as WorkspaceRole[]).map((r) => (
          <div key={r} className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{inviteLink ? "Invitation created" : "Invite a teammate"}</DialogTitle>
            <DialogDescription>
              {inviteLink ? "Share this link with your teammate. It expires in 14 days." : "They'll get access to this workspace with the role you choose."}
            </DialogDescription>
          </DialogHeader>
          {inviteLink ? (
            <div className="space-y-3">
              <Input readOnly value={inviteLink} aria-label="Invite link" className="h-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <DialogFooter>
                <CopyButton value={inviteLink} label="Copy invite link" />
                <Button onClick={() => setInviteOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit(async (values) => {
                const r = await run(() => inviteMemberAction(values), { success: `Invitation sent to ${values.email}` });
                if (r.ok) {
                  setInviteLink(r.data.link);
                  router.refresh();
                } else applyFieldErrors(form, r.fieldErrors);
              })}
            >
              {seatsFull && <FormError message="All seats on your plan are in use. Upgrade to invite more people." />}
              <FormError message={error && !Object.keys(form.formState.errors).length ? error : null} />
              <FormField id="invite-email" label="Email address" error={form.formState.errors.email?.message} required>
                <Input {...fieldA11y("invite-email", form.formState.errors.email?.message)} type="email" placeholder="teammate@company.com" className="h-9" {...form.register("email")} />
              </FormField>
              <FormField id="invite-role" label="Role" hint={ROLE_DESCRIPTIONS[inviteRoleValue as WorkspaceRole]}>
                <NativeSelect id="invite-role" {...form.register("role")}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </NativeSelect>
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || seatsFull}>
                  {pending && <Loader2 className="animate-spin" />} Send invitation
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activityFor} onOpenChange={(o) => !o && setActivityFor(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activityFor?.name}&apos;s activity</DialogTitle>
            <DialogDescription>
              {activityFor ? `${activityFor.openTasks} open tasks · ${activityFor.completedTasks} completed` : ""}
            </DialogDescription>
          </DialogHeader>
          {!activity ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading activity" />
            </div>
          ) : activity.length ? (
            <ol className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="text-sm">
                  {a.sentence}
                  <span className="block text-xs text-muted-foreground">{formatRelative(a.createdAt)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "member"}?`}
        description="They'll lose access to this workspace immediately. Their tasks become unassigned; their comments and activity stay."
        confirmLabel="Remove member"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const r = await run(() => removeMemberAction({ userId: removing.userId }), { success: `${removing.name} was removed` });
          if (r.ok) router.refresh();
          return r.ok;
        }}
      />
    </div>
  );
}
