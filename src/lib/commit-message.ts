/** A git commit message split the way git itself treats it: subject line, then body. */
export interface ParsedCommitMessage {
  subject: string;
  body: string;
}

export function parseCommitMessage(
  message: string | null | undefined,
): ParsedCommitMessage {
  const normalized = (message ?? "").replace(/\r\n/g, "\n");
  const breakIndex = normalized.indexOf("\n");

  if (breakIndex === -1) {
    return { subject: normalized.trim(), body: "" };
  }

  return {
    subject: normalized.slice(0, breakIndex).trim(),
    body: normalized
      .slice(breakIndex + 1)
      .replace(/^\n+/, "")
      .trimEnd(),
  };
}
