/**
 * Git object hashing utilities.
 *
 * The backend validates blobs using the exact content-addressable format:
 * - Blob: "blob <size>\0<content-bytes>"
 * - Tree: "tree <size>\0<entries>"
 * - Commit: "commit <size>\0<content>"
 *
 * The backend uses SHA-256 for blob hashes, not SHA-1.
 */

function getUtf8Bytes(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

export function getUtf8ByteLength(content: string): number {
  return getUtf8Bytes(content).byteLength;
}

async function digestSha256(bytes: Uint8Array): Promise<string> {
  const data = new Uint8Array(bytes);
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function digestSha1(bytes: Uint8Array): Promise<string> {
  const data = new Uint8Array(bytes);
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function encodeContentToBase64(content: string): string {
  const bytes = getUtf8Bytes(content);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Calculate the backend-compatible blob hash.
 * The backend hashes the bytes of the blob object header plus the raw decoded content bytes.
 */
export async function calculateBlobSHA(content: string): Promise<string> {
  const contentBytes = getUtf8Bytes(content);
  const header = `blob ${contentBytes.byteLength}\0`;
  const headerBytes = new TextEncoder().encode(header);
  const fullBytes = new Uint8Array(headerBytes.length + contentBytes.length);
  fullBytes.set(headerBytes, 0);
  fullBytes.set(contentBytes, headerBytes.length);
  return digestSha256(fullBytes);
}

/**
 * Calculate SHA-1 hash for Git tree object
 * @param entries - Tree entries
 * @returns SHA-1 hash as hex string
 */
export async function calculateTreeSHA(
  entries: Array<{ mode: string; name: string; sha: string }>,
): Promise<string> {
  const nullChar = "\0";

  // Sort entries by name (Git requirement)
  const sortedEntries = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Build tree content: "<mode> <name>\0<sha_binary>" for each entry
  const binaryParts: Uint8Array[] = [];

  for (const entry of sortedEntries) {
    const entryText = `${entry.mode} ${entry.name}${nullChar}`;
    binaryParts.push(new TextEncoder().encode(entryText));

    // Convert SHA hex to binary (20 bytes)
    const shaBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      shaBytes[i] = parseInt(entry.sha.substr(i * 2, 2), 16);
    }
    binaryParts.push(shaBytes);
  }

  // Calculate total size
  const totalSize = binaryParts.reduce((sum, part) => sum + part.length, 0);

  // Build final tree object
  const header = new TextEncoder().encode(`tree ${totalSize}${nullChar}`);
  const fullTree = new Uint8Array(header.length + totalSize);

  let offset = 0;
  fullTree.set(header, offset);
  offset += header.length;

  for (const part of binaryParts) {
    fullTree.set(part, offset);
    offset += part.length;
  }

  // Tree objects are still hashed in Git-compatible form using SHA-1.
  return digestSha1(fullTree);
}

/**
 * Calculate SHA-1 hash for Git commit object
 * @param data - Commit data
 * @returns SHA-1 hash as hex string
 */
export async function calculateCommitSHA(data: {
  treeSHA: string;
  parentSHAs: string[];
  author: string;
  committer: string;
  message: string;
}): Promise<string> {
  const nullChar = "\0";

  // Build commit content
  let commitContent = `tree ${data.treeSHA}\n`;

  // Add parents
  for (const parentSHA of data.parentSHAs) {
    commitContent += `parent ${parentSHA}\n`;
  }

  commitContent += `author ${data.author}\n`;
  commitContent += `committer ${data.committer}\n`;
  commitContent += `\n${data.message}\n`;

  // Add header
  const contentBytes = getUtf8Bytes(commitContent);
  const header = `commit ${contentBytes.byteLength}${nullChar}`;
  const fullContent = header + commitContent;

  const contentData = getUtf8Bytes(fullContent);
  return digestSha1(contentData);
}

/**
 * Format Git timestamp
 * @param date - Date object
 * @returns Git timestamp string (e.g., "1234567890 +0000")
 */
export function formatGitTimestamp(date: Date = new Date()): string {
  const unixTimestamp = Math.floor(date.getTime() / 1000);
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? "+" : "-";
  const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, "0")}${offsetMinutes.toString().padStart(2, "0")}`;

  return `${unixTimestamp} ${offsetString}`;
}

/**
 * Format Git author/committer string
 * @param name - Name
 * @param email - Email
 * @param date - Date
 * @returns Git author string (e.g., "John Doe <john@example.com> 1234567890 +0000")
 */
export function formatGitPerson(
  name: string,
  email: string,
  date: Date = new Date(),
): string {
  return `${name} <${email}> ${formatGitTimestamp(date)}`;
}
