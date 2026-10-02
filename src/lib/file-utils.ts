export const DOC_EXTS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"] as const;
export const IMAGE_EXTS = ["jpg", "jpeg", "png"] as const;

export function ext(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function typeLabel(name: string) {
  const e = ext(name);
  if (e === "pdf") return "PDF";
  if (e === "doc" || e === "docx") return "Word";
  if (IMAGE_EXTS.includes(e as never)) return "Image";
  return e.toUpperCase();
}

export function mimeFor(name: string) {
  const e = ext(name);
  return (
    {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
    } as Record<string, string>
  )[e] ?? "application/octet-stream";
}

export function validateFile(file: File, allowed: readonly string[], maxMb: number): string | null {
  if (!allowed.includes(ext(file.name))) return `${file.name}: unsupported file type`;
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > maxMb * 1024 * 1024) return `${file.name}: larger than ${maxMb} MB`;
  return null;
}

export async function countPdfPages(file: Blob): Promise<number | null> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

export async function docxToHtml(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await (mammoth.default ?? mammoth).convertToHtml({ arrayBuffer: buf });
  return res.value;
}

/** Uploads a file to a signed upload URL with progress reporting. */
export function uploadWithProgress(signedUrl: string, file: Blob, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}
