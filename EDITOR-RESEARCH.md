# Photo Editor research (Nov 18, 2026, Glen's directive: best free starter, agentic)

## The match for what Glen described
Photopea (photopea.com): a full Photoshop that runs in the browser, built largely by ONE developer, Ivan Kutskir, since 2013. Layers, masks, PSD, healing, the works. It has a free developer API: embed the editor in your own app in an iframe, preload a file, run Photoshop-style JavaScript scripts against it, and receive the edited file back (its save action can POST the document to your endpoint). There is also a community MCP server (photopea-mcp-server, 46 tools) that lets an AI agent drive Photopea directly, and a photopea npm wrapper (photopea.js: createEmbed, runScript, saveToOE).
Honest limits: Photopea is free to embed (with its ads/branding) but is NOT open source; removing ads/branding needs a paid distributor account; its built-in AI features (Remove BG, Magic Replace) run on a third-party service (Dezgo). Files are processed locally in the visitor's browser, never uploaded to Photopea servers.

## Open source AI tools (free, self-hostable, API driven)
- rembg (MIT, github.com/danielgatis/rembg): background removal (U2-Net / BiRefNet models). Ships a server mode with an HTTP API. This is the background remover.
- IOPaint (Apache 2.0, github.com/Sanster/IOPaint): object removal / inpainting (LaMa and others), self-hostable web UI + API. This is the magic eraser.
- Real-ESRGAN (BSD-3, github.com/xinntao/Real-ESRGAN): 2x/4x upscaling and restoration.
- GFPGAN (Apache 2.0 code): face restoration.
- Browser-side alternative for background removal with no server: @imgly/background-removal (ONNX in the browser).

## Decision for Phase 5B (editor)
1. Keep the built-in quick editor (Phase 5A: filters, sliders, crop, rotate) for fast fixes.
2. Add a "Pro Editor" that embeds Photopea through its free API: opens the current photo, and on save posts the result back to Pixelset as a new photo in the same set (save-as-copy semantics, original untouched). Label it honestly in the UI as Photopea.
3. Add an "AI tools" panel wired to self-hosted open source services, configured by env endpoints (AI_TOOLS_ENDPOINT for a small proxy that fronts rembg / IOPaint / Real-ESRGAN): Remove Background, Magic Eraser (inpaint), Upscale 2x/4x, Restore Faces. When no endpoint is configured, the panel says the AI service is not connected and the buttons stay disabled, same honesty pattern as Resend email and the lab. Ship a tiny reference proxy (Node or Python) in a tools folder that maps the three endpoints to local rembg / IOPaint / Real-ESRGAN CLIs, so a self-hoster can turn it on.
4. Everything stays free: no paid SDKs, no per-image API fees.
