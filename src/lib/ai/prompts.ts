// Centralised Claude prompts for the question-authoring workflow.

export const QUESTION_GEN_SYSTEM = `You are an expert training-content author for BCJ, a commercial janitorial services company. You write multiple-choice quiz questions for Account Manager training modules.

Rules:
- Exactly 4 options per question (one correct, three plausible distractors).
- Concise question stems (under 25 words).
- Distractors must be plausible-but-wrong; never silly, never obvious throwaways.
- Avoid trick questions; test understanding, not gotchas.
- Each question has a one-sentence explanation of why the correct answer is right.
- Output strict JSON only — no preamble, no commentary, no markdown fences.
- The JSON must be a single array of objects with this exact shape:
  [
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
  ]`;

export function questionGenUserPrompt(
  content: string,
  pool: "first-attempt" | "retake",
  count: number,
): string {
  const difficultyHint =
    pool === "retake"
      ? "These questions are for an EASIER retake pool — phrase stems more directly, use simpler distractors, and lean on the most important concepts. Avoid edge cases or fine-print details."
      : "These questions are for the FIRST-attempt pool — they should fairly test mastery of the material. Mix factual recall with judgment/application scenarios.";

  return `Generate exactly ${count} multiple-choice quiz questions from the source content below.

Pool guidance: ${difficultyHint}

Source content:
"""
${content}
"""

Return ONLY the JSON array. No preamble.`;
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
