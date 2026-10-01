const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function safeHex(
  color: string | null | undefined,
  fallback = "#64748b",
) {
  return color && HEX.test(color) ? color : fallback;
}
