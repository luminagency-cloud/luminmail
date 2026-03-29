import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeScreenshotFilename, validateScreenshotFile } from "@/lib/server/issue-report-utils";

test("sanitizeScreenshotFilename strips unsafe characters", () => {
  assert.equal(sanitizeScreenshotFilename("bad file name (1).png"), "bad_file_name_1_.png");
});

test("validateScreenshotFile rejects non-images", () => {
  assert.equal(validateScreenshotFile({ name: "note.txt", type: "text/plain", size: 123 }), "Screenshot must be an image file.");
});
