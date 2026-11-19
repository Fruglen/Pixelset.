import { createHash } from "crypto";

// Phase 5B platform: gallery custom domain verification token, derived from
// the account id so it is stable without storing a secret.
export function galleryDomainToken(userId: string): string {
  return createHash("sha256").update(`gallery-domain:${userId}`).digest("hex").slice(0, 18);
}
