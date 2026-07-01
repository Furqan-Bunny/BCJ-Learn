import "server-only";

// Extract readable text from a lesson's content file so the AI has real source
// material. Downloads the file from the private module-content bucket and parses
// by type: Word/PDF/CSV/text directly, slides (pptx) via unzip, images + video
// via OpenAI (vision / Whisper). Falls back to legacy placeholder metadata.

import { createAdminClient } from "@/lib/supabase/server";
import { openaiClient, CHAT_MODEL, TRANSCRIBE_MODEL } from "./openai";
import { toFile } from "openai";

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

export interface ContentForExtract {
  type: string;
  title: string;
  storagePath?: string | null;
  fileName?: string | null;
  metadata?: unknown;
}

export interface ExtractResult {
  text: string;
  note?: string; // surfaced to the user (e.g. "video too large")
}

function ext(name?: string | null): string {
  return (name?.split(".").pop() ?? "").toLowerCase();
}

async function download(path: string): Promise<{ buffer: Buffer; blob: Blob }> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("module-content").download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not download file");
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, blob: data };
}

export async function extractTextForContent(c: ContentForExtract): Promise<ExtractResult> {
  // 1. Use cached extraction if present.
  const meta = c.metadata as
    | { extractedText?: string; documentPages?: string[]; slides?: { title: string; bullets: string[] }[] }
    | null;
  if (meta?.extractedText && meta.extractedText.trim().length > 0) {
    return { text: meta.extractedText };
  }

  // 2. No stored file → fall back to any legacy placeholder text in metadata.
  if (!c.storagePath) {
    const chunks: string[] = [];
    if (meta?.documentPages) chunks.push(...meta.documentPages);
    if (meta?.slides) for (const s of meta.slides) chunks.push(`${s.title}\n${(s.bullets ?? []).join("\n")}`);
    return { text: chunks.join("\n\n") };
  }

  const e = ext(c.fileName);
  try {
    if (e === "docx") {
      const { buffer } = await download(c.storagePath);
      const mammoth = (await import("mammoth")).default;
      const res = await mammoth.extractRawText({ buffer });
      return { text: res.value ?? "" };
    }

    if (e === "pdf") {
      const { buffer } = await download(c.storagePath);
      // pdf-parse is kept external (next.config serverExternalPackages) and loaded
      // at runtime via createRequire with a variable specifier so the bundler never
      // tries to resolve it. v2's CJS entry exports a `PDFParse` class (NOT the old
      // v1 callable): construct with `{ data: buffer }`, then `getText()`.
      const { createRequire } = await import("node:module");
      const req = createRequire(import.meta.url);
      const pkg = "pdf-parse";
      const { PDFParse } = req(pkg) as typeof import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        // Override the default pageJoiner ("-- N of M --") so page markers don't
        // pollute the text the AI sees.
        const res = await parser.getText({ pageJoiner: "\n\n" });
        return { text: res.text ?? "" };
      } finally {
        await parser.destroy(); // release the underlying pdf.js worker/resources
      }
    }

    if (e === "csv" || e === "txt" || e === "md") {
      const { buffer } = await download(c.storagePath);
      return { text: buffer.toString("utf-8") };
    }

    if (e === "pptx") {
      const { buffer } = await download(c.storagePath);
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
          const n = (s: string) => Number(s.match(/slide(\d+)\.xml/)?.[1] ?? 0);
          return n(a) - n(b);
        });
      const slides: string[] = [];
      for (const f of slideFiles) {
        const xml = await zip.files[f].async("text");
        const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
        if (texts.length) slides.push(texts.join(" "));
      }
      return { text: slides.join("\n\n") };
    }

    if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) {
      const { buffer } = await download(c.storagePath);
      const mime = e === "png" ? "image/png" : e === "webp" ? "image/webp" : e === "gif" ? "image/gif" : "image/jpeg";
      const openai = openaiClient();
      const res = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe all text and summarize the key information in this training slide/document image." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${buffer.toString("base64")}` } },
            ],
          },
        ],
      });
      return { text: res.choices[0]?.message?.content ?? "" };
    }

    if (c.type === "video" || ["mp4", "mov", "webm", "m4a", "mp3", "wav"].includes(e)) {
      const { buffer, blob } = await download(c.storagePath);
      if (buffer.byteLength > WHISPER_MAX_BYTES) {
        return { text: "", note: `"${c.title}" is too large to auto-transcribe (over 25 MB). Upload a smaller clip or add a transcript.` };
      }
      const openai = openaiClient();
      const file = await toFile(buffer, c.fileName ?? "audio.mp4", { type: blob.type || "video/mp4" });
      const tr = await openai.audio.transcriptions.create({ model: TRANSCRIBE_MODEL, file });
      return { text: tr.text ?? "" };
    }
  } catch (err) {
    return { text: "", note: `Could not read "${c.title}": ${(err as Error).message}` };
  }

  return { text: "", note: `Unsupported file type for "${c.title}".` };
}
