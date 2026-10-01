// Time zone validation against the runtime's IANA database. Accepts aliases the browser may
// report (e.g. "Asia/Calcutta") by resolving them to their canonical name.
export function normalizeTimezone(value: string): string | null {
  if (!value || value.length > 64) return null;
  if (value === "UTC" || value === "Etc/UTC") return "UTC";
  try {
    const supported = Intl.supportedValuesOf("timeZone");
    if (supported.includes(value)) return value;
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    return supported.includes(resolved) || resolved === "UTC" ? resolved : null;
  } catch {
    return null;
  }
}
