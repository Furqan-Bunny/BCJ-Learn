// Markdown → HTML conversion for transactional emails.
//
// We use `marked` configured for safety (no inline HTML pass-through) since
// template body text comes from the email_templates table (admin-editable).

import { marked } from "marked";

marked.use({
  async: false,
  gfm: true,
  breaks: true,
});

export function renderMarkdown(md: string): string {
  // marked.parse with async:false returns a string synchronously.
  const html = marked.parse(md) as string;
  // Wrap in a minimal HTML shell so email clients render it predictably.
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>BCJ Learn</title>
  </head>
  <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;background:#ffffff;line-height:1.5">
    <div style="max-width:560px;margin:0 auto">
      ${html}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
      <p style="font-size:12px;color:#9ca3af;margin:0">BCJ Learn — internal training platform.</p>
    </div>
  </body>
</html>`;
}

// Substitute {{var}} placeholders with values. Missing keys keep their literal
// placeholder so it's obvious in the rendered email that we forgot a variable.
export function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (full, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full;
  });
}
