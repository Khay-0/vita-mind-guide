import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const PROMPT = `Tu es Vita, coach santé. À partir de la conversation fournie, génère un PLAN DE SUIVI au format JSON STRICT (pas de markdown, pas de texte autour) :
{
  "title": "<2-4 mots, ex: Acné légère>",
  "emoji": "<un emoji pertinent>",
  "summary": "<1 phrase: ce qu'on suit>",
  "plan": ["<conseil concret 1>", "<conseil concret 2>", "<conseil concret 3>", "<conseil concret 4>"]
}
Les conseils doivent être actionnables au quotidien (hydratation, alimentation, sommeil, hygiène, exercices…) et adaptés au problème. 3 à 5 conseils max.`;

export const Route = createFileRoute("/api/tracker-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);
        const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
        const { data: claims, error } = await supa.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages: { role: string; content: string }[] };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const convo = body.messages
          .slice(-12)
          .map((m) => `${m.role.toUpperCase()}: ${typeof m.content === "string" ? m.content : "[contenu riche]"}`)
          .join("\n");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: PROMPT },
              { role: "user", content: convo },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(`AI error: ${t.slice(0, 200)}`, { status: 500 });
        }
        const j = await upstream.json();
        const raw = j.choices?.[0]?.message?.content ?? "{}";
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {};
        }
        return new Response(
          JSON.stringify({
            title: String(parsed.title || "Mon suivi").slice(0, 60),
            emoji: String(parsed.emoji || "🩺").slice(0, 4),
            summary: String(parsed.summary || "").slice(0, 200),
            plan: Array.isArray(parsed.plan) ? parsed.plan.slice(0, 6).map((p: any) => String(p).slice(0, 160)) : [],
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});