export type DemoSubscriber = {
  email: string;
  is_paid: boolean;
  subscription_end: string | null;
  created_at: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __mdDemoSubscribers: DemoSubscriber[] | undefined;
}

function store(): DemoSubscriber[] {
  if (!globalThis.__mdDemoSubscribers) {
    globalThis.__mdDemoSubscribers = [
      {
        email: "owner@milliondeal.app",
        is_paid: true,
        subscription_end: null,
        created_at: new Date().toISOString(),
      },
    ];
  }
  return globalThis.__mdDemoSubscribers;
}

export function listDemoSubscribers() {
  return [...store()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function upsertDemoSubscriber(input: {
  email: string;
  is_paid: boolean;
  subscription_end?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const rows = store();
  const idx = rows.findIndex((r) => r.email === email);
  const row: DemoSubscriber = {
    email,
    is_paid: input.is_paid,
    subscription_end: input.subscription_end ?? null,
    created_at: idx >= 0 ? rows[idx].created_at : new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  return row;
}

export function deleteDemoSubscriber(email: string) {
  const target = email.trim().toLowerCase();
  const rows = store();
  const next = rows.filter((r) => r.email !== target);
  globalThis.__mdDemoSubscribers = next;
  return next.length !== rows.length;
}
