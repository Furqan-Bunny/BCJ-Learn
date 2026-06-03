import "server-only";

// Makes a module's uploaded content actually presentable. When files are
// uploaded, the lessons builder only stores placeholders ("Document
// uploaded.", "Uploaded slides — preview opens via signed URL") and never the
// real content. This module fills in the real thing on first present:
//
//   • documents → extract text, paginate, cache to metadata.documentPages
//   • slides    → extract per-slide text from the .pptx, cache to metadata.slides
//   • videos    → mint a short-lived signed URL so the file actually plays
//
// Text extraction is cached (paid once); signed URLs are minted per render
// (they expire), so attachSignedMedia runs every time.

import { createAdminClient } from "@/lib/supabase/server";
import { extractTextForContent } from "@/lib/ai/extract";
import type { ModuleDef } from "@/types";

const DOC_PLACEHOLDER = /Document uploaded\./;
const SLIDE_PLACEHOLDER = /preview opens via signed URL/i;
const PAGE_CHAR_LIMIT = 1800;
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

interface ContentMeta {
  documentPages?: string[];
  slides?: { title: string; bullets: string[] }[];
  slideCount?: number;
  extractedText?: string;
  fileName?: string;
  [k: string]: unknown;
}

function ext(name?: string | null): string {
  return (name?.split(".").pop() ?? "").toLowerCase();
}

function paginate(text: string, title: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const pages: string[] = [];
  let current = `# ${title}\n\n`;
  for (const para of paragraphs) {
    if (current.length + para.length > PAGE_CHAR_LIMIT && current.trim().length > title.length + 3) {
      pages.push(current.trim());
      current = "";
    }
    current += para + "\n\n";
  }
  if (current.trim()) pages.push(current.trim());
  return pages;
}

function hasRealDocPages(pages: string[] | undefined): boolean {
  return !!pages && pages.length > 0 && !pages.every((p) => DOC_PLACEHOLDER.test(p));
}

function hasRealSlides(slides: { title: string; bullets: string[] }[] | undefined): boolean {
  return !!slides && slides.length > 0 && !slides.every((s) => (s.bullets ?? []).some((b) => SLIDE_PLACEHOLDER.test(b)));
}

/** Parse a .pptx buffer into per-slide { title, bullets }. */
async function extractSlides(buffer: Buffer, fallbackTitle: string): Promise<{ title: string; bullets: string[] }[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const n = (s: string) => Number(s.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return n(a) - n(b);
    });

  const slides: { title: string; bullets: string[] }[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("text");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean);
    // Keep EVERY slide (even image-only / text-light ones) so the count and
    // pagination match the real deck — don't silently drop empty slides.
    const [first, ...rest] = texts;
    slides.push({
      title: first || `${fallbackTitle} — slide ${i + 1}`,
      bullets: texts.length ? (rest.length ? rest : [first]) : [],
    });
  }
  return slides;
}

/**
 * Extract & cache real text content (documents + slides). Safe to call on every
 * present-page render — does nothing once a content item is already filled in.
 */
export async function ensurePresentableContent(slug: string): Promise<void> {
  const admin = createAdminClient();

  const { data: lessons } = await admin.from("lessons").select("id").eq("module_slug", slug);
  if (!lessons?.length) return;
  const lessonIds = lessons.map((l) => l.id);

  const { data: contents } = await admin
    .from("lesson_contents")
    .select("id, type, title, storage_path, metadata")
    .in("lesson_id", lessonIds)
    .in("type", ["document", "slides"]);
  if (!contents?.length) return;

  for (const c of contents) {
    const meta = (c.metadata ?? {}) as ContentMeta;
    if (!c.storage_path) continue;

    if (c.type === "document") {
      if (hasRealDocPages(meta.documentPages)) continue;
      const { text } = await extractTextForContent({
        type: c.type, title: c.title, storagePath: c.storage_path, fileName: meta.fileName ?? null, metadata: meta,
      });
      const pages = paginate(text, c.title);
      if (!pages.length) continue;
      await admin.from("lesson_contents")
        .update({ metadata: { ...meta, documentPages: pages, extractedText: meta.extractedText ?? text } })
        .eq("id", c.id);
    } else if (c.type === "slides") {
      if (hasRealSlides(meta.slides)) continue;
      if (ext(meta.fileName) !== "pptx") continue; // only .pptx can be parsed into slides
      try {
        const { data } = await admin.storage.from("module-content").download(c.storage_path);
        if (!data) continue;
        const buffer = Buffer.from(await data.arrayBuffer());
        const slides = await extractSlides(buffer, c.title);
        if (!slides.length) continue;
        await admin.from("lesson_contents").update({ metadata: { ...meta, slides, slideCount: slides.length } }).eq("id", c.id);
      } catch {
        // leave the placeholder; presenter still shows the title
      }
    }
  }
}

/**
 * Mint signed URLs for uploaded video/audio files so they actually play in the
 * presenter. Mutates the module in place: any video content that was uploaded
 * (has a storagePath but no real http video URL) gets a fresh signed URL.
 */
export async function attachSignedMedia(mod: ModuleDef): Promise<void> {
  const admin = createAdminClient();
  for (const lesson of mod.lessons) {
    for (const content of lesson.contents) {
      if (content.type !== "video") continue;
      const url = content.videoUrl ?? "";
      const isHosted = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
      if (isHosted || !content.storagePath) continue; // hosted embed or nothing to sign
      const { data } = await admin.storage
        .from("module-content")
        .createSignedUrl(content.storagePath, SIGNED_URL_TTL_SEC);
      if (data?.signedUrl) content.videoUrl = data.signedUrl;
    }
  }
}
