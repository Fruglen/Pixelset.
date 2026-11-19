// Phase 5B platform: how to serve the website under a path of an existing
// domain (for example a WordPress site at yourstudio.com with the portfolio at
// yourstudio.com/photos), through a reverse proxy.
export function SubdirectoryCard({ upstream }: { upstream: string }) {
  const nginx = `# nginx, inside the server block for yourstudio.com
location /photos/ {
  proxy_pass ${upstream}/;
  proxy_set_header Host ${upstream.replace(/^https?:\/\//, "")};
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Prefix /photos;
}
# page assets and uploaded images are served from the root paths
location /_next/   { proxy_pass ${upstream}/_next/; proxy_set_header Host ${upstream.replace(/^https?:\/\//, "")}; }
location /uploads/ { proxy_pass ${upstream}/uploads/; proxy_set_header Host ${upstream.replace(/^https?:\/\//, "")}; }
location /api/     { proxy_pass ${upstream}/api/; proxy_set_header Host ${upstream.replace(/^https?:\/\//, "")}; }`;
  return (
    <section className="card p-5 space-y-2" id="subdirectory">
      <h2 className="font-display text-lg">Host under an existing domain path</h2>
      <p className="text-sm text-neutral-500">
        Keep your existing site and serve this website at a path such as yourstudio.com/photos, which keeps search ranking on
        one domain. Add a reverse proxy rule on that domain&rsquo;s server. Every link, the menu and the sitemap are then built under
        the path you choose (sent in the X-Forwarded-Prefix header). Page assets live at /_next/, /uploads/ and /api/, so those
        three paths must also be forwarded, which means they cannot be in use by your existing site. This is configured on your own server; no ranking result
        can be promised by any builder.
      </p>
      <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-3 overflow-x-auto">{nginx}</pre>
    </section>
  );
}
