# PIXELSET NIGHT BUILD — Glen's order, Nov 18, 2026 ~17:45 CT
Target: ALL remaining features built by morning Nov 19. Verified state at start:
230 BUILT / 20 PARTIAL / 115 NOT BUILT of 365 (FEATURE-ACCOUNTING.md, re-audit 14:07).
Remaining: Client Gallery 31 NB | Website 17 NB + 1 P | Studio Manager 19 NB + 1 P |
Store 9 NB | Photo Editor 5 NB | Mobile App 2 NB | Pricing 22 NB + 1 P |
Platform 3 NB + 7 P | Extras 7 NB + 10 P.

## SPLIT (stay in your lane; shared files schema.prisma + package.json are READ-ONLY
for builders — append schema needs to NIGHT-SCHEMA-NEEDS.md instead)
- CLAUDE (opus): Client Gallery NOT BUILT (31) + Platform and Account (7P + 3NB)
- BUILDER A: Website (17NB + 1P) + Photo Editor (5NB) + Mobile Gallery App (2NB)
- BUILDER B: Studio Manager (19NB + 1P) + Store (9NB, except Partner labs row = main agent)
- MAIN AGENT: Pricing and Plans (22NB + 1P) + Extras (7NB + 10P) + Prodigi lab adapter
  (src/lib/lab.ts) + schema needs + build verification + accounting + GitHub pushes

## RULES FOR EVERY BUILDER
1. Read SPEC.md and your FEATURE-ACCOUNTING.md rows before building. Build the real
   behaviour a photographer/client would use, in the existing code patterns.
2. Payments stay PARKED (owner's order): build the full logic, UI and processor
   code paths, env-gated, honest "not connected" state when no key is set. Never
   fake a live charge.
3. External integrations (Google Calendar, GA, Facebook Pixel, Lightroom): build the
   complete integration code + settings UI, env/credential-gated, honest states.
4. After each section batch: run `npm run build`; fix YOUR errors before moving on.
   Never edit another lane's files. If the build breaks because of another lane's
   in-flight work, note it in NIGHT-BUILD-LOG.md and continue with your next item.
5. Update FEATURE-ACCOUNTING.md rows ONLY in your sections (status + plain note).
6. Append timestamped progress lines to NIGHT-BUILD-LOG.md.
7. No em dashes in user-facing copy. Demo login demo@pixelset.app / demo1234 must keep working.
