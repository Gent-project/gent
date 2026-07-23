/**
 * Git SHA-1 Hash Utilities
 *
 * Git uses SHA-1 hashing with specific object formats:
 * - Blob: "blob <size>\0<content>"
 * - Tree: "tree <size>\0<entries>"
 * - Commit: "commit <size>\0<data>"
 */

/**
 * Calculate SHA-1 hash for Git blob object
 * @param content - The file content (string)
 * @returns SHA-1 hash as hex string
 */
export async function calculateBlobSHA(content: string): Promise<string> {
  const nullChar = "\0";
  const header = `blob ${content.length}${nullChar}`;
  const fullContent = header + content;

  const encoder = new TextEncoder();
  const data = encoder.encode(fullContent);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
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
  let treeContent = "";
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

  // Calculate SHA-1
  const hashBuffer = await crypto.subtle.digest("SHA-1", fullTree);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
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
  const header = `commit ${commitContent.length}${nullChar}`;
  const fullContent = header + commitContent;

  const encoder = new TextEncoder();
  const contentData = encoder.encode(fullContent);
  const hashBuffer = await crypto.subtle.digest("SHA-1", contentData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
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
