import type { DocTheme } from "@/lib/doc-theme";

// Fix batch 2026-11-20: loads any extra fonts a document theme needs (website
// font library picks from Google Fonts, uploaded fonts via @font-face).
export function DocThemeHead({ theme }: { theme: DocTheme }) {
  return (
    <>
      {theme.fontsHref ? <link rel="stylesheet" href={theme.fontsHref} /> : null}
      {theme.faceCss ? <style dangerouslySetInnerHTML={{ __html: theme.faceCss }} /> : null}
    </>
  );
}
