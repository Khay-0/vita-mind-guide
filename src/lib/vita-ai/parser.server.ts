import { VitaResponseSchema, type VitaResponse } from "./schemas";

// Best-effort JSON extraction + Zod validation.
// Returns parsed VitaResponse or null (caller handles fallback).
export function parseVitaResponse(raw: string): VitaResponse | null {
  if (!raw || typeof raw !== "string") return null;

  // 1. Strip common code fences.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    s = s.trim();
  }

  // 2. Try direct parse.
  const tryParse = (input: string): VitaResponse | null => {
    try {
      const obj = JSON.parse(input);
      const result = VitaResponseSchema.safeParse(obj);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(s);
  if (direct) return direct;

  // 3. Extract first balanced {...} block.
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        const parsed = tryParse(candidate);
        if (parsed) return parsed;
        break;
      }
    }
  }

  // 4. Last resort: try trimming trailing junk that breaks JSON.
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace > start) {
    const parsed = tryParse(s.slice(start, lastBrace + 1));
    if (parsed) return parsed;
  }

  return null;
}

// Fallback wrapping a plain-text answer into a minimal valid response.
export function plainTextFallback(text: string): VitaResponse {
  return {
    message: text.trim().slice(0, 1900) || "Je n'ai pas pu formater ma réponse, mais je suis là. Peux-tu reformuler ?",
    stage: "info",
    urgency: "low",
  };
}
