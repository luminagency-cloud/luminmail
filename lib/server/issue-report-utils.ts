export const ISSUE_REPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function sanitizeScreenshotFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "screenshot";
}

export function validateScreenshotFile(input: { name: string; type: string; size: number }) {
  if (!input.type.startsWith("image/")) {
    return "Screenshot must be an image file.";
  }

  if (input.size > ISSUE_REPORT_MAX_IMAGE_BYTES) {
    return `Screenshot must be ${Math.floor(ISSUE_REPORT_MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
  }

  return null;
}
