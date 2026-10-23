// /admin is gated by one shared passcode (newsletter-config.ts). A correct passcode earns a signed, expiring, httpOnly cookie.
// Every server action and route under /admin must call isAdmin() itself: actions are public endpoints, so hiding the
// page is not enough.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_PASSCODE } from "./newsletter-config";

const COOKIE = "haav_admin";
const SESSION_SECONDS = 60 * 60 * 12;

// The passcode is in the public repo, so sessions are signed with the Resend API key too. Without that key nobody can
// sign in, which keeps the admin locked rather than letting a cookie be forged.
const secret = () => process.env.RESEND_API_KEY;

const digest = (s: string) => createHash("sha256").update(s).digest();

export function passcodeMatches(attempt: string): boolean {
  return Boolean(secret()) && timingSafeEqual(digest(attempt), digest(ADMIN_PASSCODE));
}

// Changing the passcode (or the Resend key) signs every existing session out.
const sign = (exp: number) => createHmac("sha256", `${ADMIN_PASSCODE}:${secret() ?? ""}`).update(`admin.${exp}`).digest("hex");

export async function startSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function isAdmin(): Promise<boolean> {
  if (!secret()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expText, mac = ""] = value.split(".");
  const exp = Number(expText);
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
