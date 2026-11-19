# Pixelset Phase 5B brief: build EVERY remaining feature

Owner's direct order (Nov 18, 2026): build all remaining features. Nothing partial, nothing missing, except the two standing exclusions below.

## Where things stand
- App: ~/workspace/pixelset-replica (Next.js 14 App Router + TypeScript + Tailwind + Prisma + SQLite). Read SPEC.md, BUILD-NOTES.md, and EDITOR-RESEARCH.md first.
- FEATURE-ACCOUNTING.md lists 365 features: 141 BUILT, 98 PARTIAL, 126 NOT BUILT. Those counts predate Phase 5A.
- Phase 5A (already done, see BUILD-NOTES.md) finished: Resend mailer module, lab fulfillment pipeline, video in galleries, RAW support, editor crop/rotate/flip, Picflow gallery linking. Some accounting rows marked NOT BUILT are therefore already built. Do not build anything twice.
- UNBUILT-FEATURES.md is the extracted work list (224 rows).

## Your job, in order
1. RE-AUDIT: go through every PARTIAL and NOT BUILT row in FEATURE-ACCOUNTING.md and check it against the current code. Update each row's status and notes to the truth. This corrected accounting is the work queue.
2. BUILD THE PARTIALS FIRST: finish every PARTIAL feature to FULLY built before starting any NOT BUILT feature. The owner's words: he would rather have 200 fully built features than features half built. A partial only counts as done when it behaves the way the research describes, end to end, not when a simplified version exists.
3. THEN BUILD THE NOT BUILT: build every NOT BUILT feature, section by section (Client Gallery, Store, Website, Studio Manager, Photo Editor, Mobile Gallery App, platform extras). Use the "To finish:" guidance in each row as the spec. Where a row depends on another, build in dependency order.
4. TARGET: at least 90 percent of the 365 features FULLY built at the end of this phase, and the goal is every single one. If anything remains unbuilt, BUILD-NOTES.md must name it and say exactly why.
3. PRO EDITOR: implement the plan in EDITOR-RESEARCH.md: a "Pro Editor" that embeds Photopea through its free developer API (preload the photo, save-back creates a new photo in the same set), plus an AI tools panel (background removal, object removal/inpainting, upscale, face restore) wired to an env-configured self-hosted endpoint (AI_TOOLS_ENDPOINT). Buttons must be honestly disabled with a clear note when no endpoint is configured. Ship the tiny reference proxy described in the research.
4. Keep `npm run build` passing after each section. Run `npm run seed` when you add seed data. Smoke test what you build (login demo@pixelset.app / demo1234).
5. As each feature lands, update its row in FEATURE-ACCOUNTING.md to BUILT with a short note, and append a Phase 5B section to BUILD-NOTES.md describing what was built. Keep the running counts accurate.

## Standing exclusions (do not build these, ever)
- Real payment processing: payments stay mocked/display only. The owner parked payments; he is the only user for now.
- The photo cloud-storage product: excluded by the owner's order. Picflow galleries link in as external references only; never import or store Picflow files.
- Do not change the visual design language of the app. New screens follow the existing design.

## Rules
- No em dashes anywhere in UI copy (use commas or hyphens).
- Honest states only: anything not connected to a real account (email, lab) must say so in the UI, never fake a success.
- Secrets come from env vars only (RESEND_API_KEY, LAB_API_KEY, AI_TOOLS_ENDPOINT). Never hardcode a key, never print one.
- Work autonomously to the end of the list. If a single feature proves impossible in this stack, finish everything else and record exactly why in BUILD-NOTES.md.
