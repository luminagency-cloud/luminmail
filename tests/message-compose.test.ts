import test from "node:test";
import assert from "node:assert/strict";
import { applySignature } from "@/lib/server/message-compose";

test("applySignature returns the body unchanged when signature is blank", () => {
  assert.equal(applySignature("Hello there", ""), "Hello there");
});

test("applySignature appends a signature with spacing", () => {
  assert.equal(applySignature("Hello there", "Thanks,\nDan"), "Hello there\n\nThanks,\nDan");
});
