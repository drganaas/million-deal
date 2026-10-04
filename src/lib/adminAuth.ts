export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || "MillionDeal2026";
}

export function getAdminEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "owner@milliondeal.app")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function verifyAdminCredentials(email: string, password: string) {
  return isAdminEmail(email) && password === getAdminPassword();
}
