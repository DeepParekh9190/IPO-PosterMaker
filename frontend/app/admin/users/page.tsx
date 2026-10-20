"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Plan, Subscription } from "@/lib/types";

interface AdminUser {
  id: string;
  email: string;
  role: "client" | "admin";
  status: string;
  business_name: string | null;
  created_at: string;
  subscription: Subscription | null;
  exports_today: number;
}

type PendingAction =
  | { kind: "status"; user: AdminUser; next: "active" | "suspended" }
  | { kind: "plan"; user: AdminUser; planId: string }
  | null;

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userResult, planResult] = await Promise.all([
        api.get<{ items: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`),
        api.get<Plan[]>("/api/plans"),
      ]);
      setUsers(userResult.items);
      setPlans(planResult);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function applyAction() {
    if (!pending) return;
    if (pending.kind === "plan" && reason.trim().length < 3) {
      toast.error("Add a short reason (audit trail).");
      return;
    }
    setBusy(true);
    try {
      if (pending.kind === "status") {
        await api.patch(`/api/admin/users/${pending.user.id}`, {
          status: pending.next,
          reason: reason || "admin action",
        });
        toast.success(`User ${pending.next}`);
      } else {
        await api.patch(`/api/admin/users/${pending.user.id}`, {
          plan_id: pending.planId,
          reason,
        });
        toast.success(`Plan set to ${pending.planId}`);
      }
      setPending(null);
      setReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search accounts, review plans and change status. Passwords and tokens are never shown.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <Input
            id="user-search"
            placeholder="Search email or business…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No users found" description="Try a different search term." />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">User</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Plan</th>
                <th scope="col" className="px-4 py-3 font-semibold">Exports today</th>
                <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{user.email}</p>
                    <p className="text-xs text-slate-500">{user.business_name || "No business name"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.status === "active" ? "emerald" : "red"}>{user.status}</Badge>
                    {user.role === "admin" && <Badge tone="blue" className="ml-1">admin</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.subscription?.plan_id === "pro" ? "emerald" : "slate"}>
                      {user.subscription?.plan_id ?? "free"}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-500">
                      {user.subscription?.status ?? "no subscription"}
                    </p>
                  </td>
                  <td className="numeric px-4 py-3 text-slate-700">{user.exports_today}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Select
                        aria-label={`Change plan for ${user.email}`}
                        className="h-8 w-28 py-1 text-xs"
                        value={user.subscription?.plan_id ?? "free"}
                        onChange={(event) =>
                          setPending({ kind: "plan", user, planId: event.target.value })
                        }
                      >
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </Select>
                      {user.status === "active" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setPending({ kind: "status", user, next: "suspended" })}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPending({ kind: "status", user, next: "active" })}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {pending && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPending(null)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              {pending.kind === "status"
                ? `${pending.next === "suspended" ? "Suspend" : "Activate"} ${pending.user.email}`
                : `Set ${pending.user.email} to the ${pending.planId} plan`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A logged administrative action: your account, this change and a timestamp are stored
              in the audit trail.
            </p>
            <label htmlFor="action-reason" className="mt-4 block text-sm font-medium text-slate-700">
              Reason
            </label>
            <Input
              id="action-reason"
              autoFocus
              className="mt-1.5"
              placeholder="e.g. manual payment received"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={busy}
                onClick={() => void applyAction()}
                disabled={reason.trim().length < 3}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
