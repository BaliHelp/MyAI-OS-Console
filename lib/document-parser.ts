/**
 * Document Parser Utility
 * Converts text, CSV, JSON, and PDF text inputs into clean Markdown format
 * for storage in gw_data_center and optimal RAG token utilization.
 */

export interface ParsedMarkdownResult {
  markdown: string;
  detectedType: string;
  charCount: number;
}

export function parseDocumentToMarkdown(
  input: string | Record<string, any>,
  mimeType?: string | null,
  fallbackTitle?: string
): ParsedMarkdownResult {
  if (!input) {
    return { markdown: "", detectedType: "text/plain", charCount: 0 };
  }

  // 1. Handle JSON Object or Stringified JSON
  if (typeof input === "object" || (typeof input === "string" && input.trim().startsWith("{"))) {
    try {
      const obj = typeof input === "object" ? input : JSON.parse(input);
      const lines: string[] = [`### ${fallbackTitle || "Structured Data Payload"}`];

      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/([A-Z])/g, " $1")
          .toUpperCase();

        if (typeof value === "object") {
          lines.push(`- **${formattedKey}**: \`${JSON.stringify(value)}\``);
        } else {
          lines.push(`- **${formattedKey}**: ${value}`);
        }
      }

      const markdown = lines.join("\n");
      return { markdown, detectedType: "application/json", charCount: markdown.length };
    } catch {
      // Fall through to plain text parsing
    }
  }

  const strInput = String(input).trim();

  // 2. Handle CSV Format (simple detection: commas and newlines)
  if (strInput.includes(",") && strInput.includes("\n")) {
    const rows = strInput.split("\n").map(r => r.trim()).filter(Boolean);
    if (rows.length > 1) {
      const headers = rows[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const markdownRows: string[] = [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
      ];

      for (let i = 1; i < Math.min(rows.length, 100); i++) {
        const cols = rows[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        markdownRows.push(`| ${cols.join(" | ")} |`);
      }

      const markdown = markdownRows.join("\n");
      return { markdown, detectedType: "text/csv", charCount: markdown.length };
    }
  }

  // 3. Plain Text / Markdown Fallback
  // Format section headings if structured key-value lines are present
  const lines = strInput.split("\n");
  const formattedLines = lines.map(line => {
    if (line.match(/^[a-zA-Z0-9_]+:\s+/)) {
      const [k, ...v] = line.split(":");
      return `- **${k.trim()}**: ${v.join(":").trim()}`;
    }
    return line;
  });

  const markdown = formattedLines.join("\n");
  return { markdown, detectedType: mimeType || "text/markdown", charCount: markdown.length };
}
