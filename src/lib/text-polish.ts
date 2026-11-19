// Mechanical text clean up that needs no AI: spacing, capitalisation,
// repeated words and space before punctuation. Used by the website AI
// writing assistant as its offline polish action.
export function localPolish(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\b(\w+)(\s+\1\b)+/gi, "$1")
    .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase())
    .trim();
}
