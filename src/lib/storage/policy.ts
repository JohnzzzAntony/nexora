// Upload validation shared by client (pre-check) and server (authoritative).

export const ALLOWED_TYPES: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/csv": ["csv"],
  "text/plain": ["txt", "log"],
};
export const ZIP_TYPES: Record<string, string[]> = { "application/zip": ["zip"], "application/x-zip-compressed": ["zip"] };


export function validateUpload(input: { filename: string; mimeType: string; size: number }, opts: { maxMb: number; allowZip: boolean }) {
  const name = input.filename.trim();
  if (!name || name.length > 200 || /[\\/:*?"<>|\x00-\x1f]/.test(name) || name.startsWith(".")) return "File name is not allowed";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const table = opts.allowZip ? { ...ALLOWED_TYPES, ...ZIP_TYPES } : ALLOWED_TYPES;
  const exts = table[input.mimeType];
  if (!exts) return `File type ${input.mimeType || "unknown"} is not allowed`;
  if (!exts.includes(ext)) return `Extension .${ext || "(none)"} does not match the file type`;
  if (input.size <= 0) return "File is empty";
  if (input.size > opts.maxMb * 1024 * 1024) return `File exceeds the ${opts.maxMb} MB limit`;
  return null;
}
