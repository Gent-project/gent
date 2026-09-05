import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { calculateBlobSHA, encodeContentToBase64 } from "./git-hash";

test("calculateBlobSHA hashes the backend blob object format", async () => {
  const content = "café";
  const encoded = new TextEncoder().encode(content);
  const header = Buffer.from(`blob ${encoded.byteLength}\0`, "utf8");
  const expected = createHash("sha256")
    .update(Buffer.concat([header, encoded]))
    .digest("hex");

  assert.equal(await calculateBlobSHA(content), expected);
});

test("encodeContentToBase64 preserves UTF-8 bytes", () => {
  const content = "café";
  const bytes = new TextEncoder().encode(content);
  const expected = Buffer.from(bytes).toString("base64");

  assert.equal(encodeContentToBase64(content), expected);
});
