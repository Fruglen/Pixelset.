import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { clientIp, loginIpAllowed } from "@/lib/ip-guard";
import { clearFailures, rateLimitKey, recordFailure, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email: normalizedEmail } });
  // GLE-118: check, verify, and record stay synchronous (no await) so parallel
  // requests cannot race the counter. Unknown emails count the same as known ones.
  const attemptKey = rateLimitKey("login", req.headers, normalizedEmail);
  const retryAfter = retryAfterSeconds(attemptKey);
  if (retryAfter > 0) return tooManyAttempts(retryAfter);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailure(attemptKey);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  clearFailures(attemptKey);
  // Night build (Pricing lane): Studio Manager Volume plan IP whitelisting.
  // Enforced only while a Volume plan is active and a list is saved.
  if (!(await loginIpAllowed(user.id, clientIp(req.headers)))) {
    return NextResponse.json(
      { error: "This account only allows sign-in from approved IP addresses. Ask the account owner to add this address in Settings > Security." },
      { status: 403 },
    );
  }
  // Team member logins bind their TeamMember role to the session; the data
  // account stays the owner's (getCurrentUser resolves teamOwnerId).
  let role = "OWNER";
  if (user.teamOwnerId) {
    const member = await db.teamMember.findFirst({ where: { loginUserId: user.id } });
    role = member?.role ?? "ASSISTANT";
  }
  await createSession(user.id, role);
  return NextResponse.json({ ok: true });
}
