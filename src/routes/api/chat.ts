import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  VITA_SYSTEM_PROMPT,
  buildProfileBlock,
  buildMemoryBlock,
} from "@/lib/vita-ai/system-prompt";
import {
  parseVitaResponse,
  plainTextFallback,
} from "@/lib/vita-ai/parser.server";
import type { VitaResponse } from "@/lib/vita-ai/schemas";

type ChatBody = {
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  profile?: Record<string, unknown> | null;
  generateTitle?: boolean;
  hasImage?: boolean;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const supaUrl = process.env.SUPABASE_URL!;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

        const verifier = createClient(supaUrl, supaKey);
        const { data: claims, error: cErr } = await verifier.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as ChatBody;

        // Bearer-scoped client to read memories under RLS.
        const supaUser = createClient(supaUrl, supaKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Memory enabled?
        let memoryEnabled = true;
        try {
          const { data: prof } = await supaUser
            .from("profiles")
            .select("memory_enabled")
            .eq("user_id", userId)
            .maybeSingle();
          if (prof && typeof prof.memory_enabled === "boolean") {
            memoryEnabled = prof.memory_enabled;
          }
        } catch {
          // ignore — default true
        }

        // Pull confirmed memories.
        let memories: Array<{ category: string; label: string; value: string }> = [];
        if (memoryEnabled) {
          try {
            const { data: mem } = await supaUser
              .from("health_memories")
              .select("category,label,value")
              .eq("confirmed_by_user", true)
              .order("updated_at", { ascending: false })
              .limit(30);
            if (Array.isArray(mem)) memories = mem;
          } catch {
            // ignore
          }
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const systemContent = [
          VITA_SYSTEM_PROMPT,
          buildProfileBlock(body.profile as never),
          buildMemoryBlock(memories),
          body.generateTitle
            ? `\nC'est le PREMIER message de la conversation : tu DOIS inclure le champ "title" (3-6 mots résumant le sujet).`
            : `\nCe n'est PAS le premier message : n'inclus PAS le champ "title".`,
        ].join("\n\n");

        const model = "openai/gpt-5-mini";

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model,
              stream: false,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemContent },
                ...body.messages,
              ],
            }),
          },
        );

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({
                ...plainTextFallback("Limite atteinte, réessaie dans un instant."),
                _error: "rate_limit",
              }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({
                ...plainTextFallback(
                  "Crédits IA épuisés. Ajoute des crédits à ton workspace pour continuer.",
                ),
                _error: "credits",
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(`AI error ${upstream.status}: ${t.slice(0, 200)}`, {
            status: upstream.status,
          });
        }

        const j = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = j.choices?.[0]?.message?.content ?? "";

        let parsed: VitaResponse | null = parseVitaResponse(raw);
        if (!parsed) parsed = plainTextFallback(raw);

        return new Response(JSON.stringify(parsed), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
