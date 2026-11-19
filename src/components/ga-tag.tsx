import Script from "next/script";

// Phase 5B platform: Google Analytics (gtag.js) for public gallery pages.
// Only rendered when the photographer saved a measurement ID in Client Gallery
// settings; nothing is loaded otherwise.
export function GaTag({ id }: { id: string }) {
  if (!/^(G|UA)-[A-Z0-9-]{4,}$/i.test(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(id)});`}
      </Script>
    </>
  );
}
