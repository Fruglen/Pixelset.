import { PRESET_FIELDS } from "./design";
import { generatePassword, generatePin } from "./utils";

// Shared preset application: turn a preset's stored settings JSON into
// collection data. Two rules ride along with the plain field copy:
//  - a preset with the PIN switched on mints a fresh download PIN per
//    collection (never the same PIN twice), and
//  - a preset with autoPassword on mints a fresh gallery password per
//    collection (the "auto-generated password per collection" preset option,
//    stored as `autoPassword: true` inside the preset's settings JSON).
export function presetSettingsData(parsed: Record<string, unknown>): {
  data: Record<string, unknown>;
  changes: string[];
} {
  const data: Record<string, unknown> = {};
  for (const field of PRESET_FIELDS) {
    if (field in parsed) data[field] = parsed[field];
  }
  const changes: string[] = ["preset settings applied"];
  if (data.pinEnabled) {
    data.downloadPin = generatePin();
    changes.push("new download PIN generated");
  }
  if (parsed.autoPassword === true) {
    data.password = generatePassword();
    changes.push("new gallery password generated");
  }
  return { data, changes };
}

export function parsePresetSettings(settings: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(settings) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
