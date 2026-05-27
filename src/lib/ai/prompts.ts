// Centralised Claude prompts for the question-authoring workflow.

export const QUESTION_GEN_SYSTEM = `You are an expert training-content author for BCJ, a commercial janitorial services company. You write multiple-choice quiz questions for Account Manager training modules.

Rules:
- Exactly 4 options per question (one correct, three plausible distractors).
- Concise question stems (under 25 words).
- Distractors must be plausible-but-wrong; never silly, never obvious throwaways.
- Avoid trick questions; test understanding, not gotchas.
- Each question has a one-sentence explanation of why the correct answer is right.
- Output strict JSON only — no preamble, no commentary, no markdown fences.
- The JSON must be a single object of this exact shape:
  {
    "questions": [
      {
        "text": "Question stem under 25 words?",
        "options": [
          {"text": "Option A", "correct": false},
          {"text": "Option B", "correct": true},
          {"text": "Option C", "correct": false},
          {"text": "Option D", "correct": false}
        ],
        "explanation": "One sentence explaining the correct answer."
      }
    ]
  }`;

export function questionGenUserPrompt(
  content: string,
  pool: "first-attempt" | "retake",
  count: number,
  avoidTexts?: string[],
): string {
  const difficultyHint =
    pool === "retake"
      ? "These questions are for an EASIER retake pool — phrase stems more directly, use simpler distractors, and lean on the most important concepts. Avoid edge cases or fine-print details."
      : "These questions are for the FIRST-attempt pool — they should fairly test mastery of the material. Mix factual recall with judgment/application scenarios.";

  const avoidBlock =
    avoidTexts && avoidTexts.length > 0
      ? `\n\nDo NOT repeat or closely paraphrase any of these already-written questions:\n${avoidTexts.map((t) => `- ${t}`).join("\n")}\n`
      : "";

  return `Generate exactly ${count} multiple-choice quiz questions from the source content below.

Pool guidance: ${difficultyHint}${avoidBlock}

Source content:
"""
${content}
"""

Return ONLY a JSON object with a "questions" array. No preamble.`;
}

export const SUMMARIZE_SYSTEM = `You are a training-content editor. You condense raw source material (documents, slide text, video transcripts) into a clear, well-structured study summary that captures every testable fact, procedure, policy, and key concept. Keep specifics (numbers, steps, names, rules). Output plain prose with short headings — no preamble.`;

export function summarizeUserPrompt(source: string): string {
  return `Summarize the following training material into a focused study guide that a quiz author can write questions from. Preserve all important facts, steps, thresholds, and definitions; drop only filler.

Source material:
"""
${source}
"""`;
}

export function questionRegenSystem(): string {
  return QUESTION_GEN_SYSTEM;
}

export function questionRegenUserPrompt(
  originalText: string,
  hint: string | null,
): string {
  return `Rewrite the following multiple-choice quiz question from a different angle. Keep the same topic and the same difficulty, but vary the phrasing and the distractor options so a learner cannot just memorise the previous version.

${hint ? `Author note: ${hint}\n\n` : ""}Original question:
"""
${originalText}
"""

Return ONLY a single JSON object (no array) with this shape:
{
  "text": "New question stem under 25 words?",
  "options": [
    {"text": "Option A", "correct": false},
    {"text": "Option B", "correct": true},
    {"text": "Option C", "correct": false},
    {"text": "Option D", "correct": false}
  ],
  "explanation": "One sentence explaining the correct answer."
}`;
}
