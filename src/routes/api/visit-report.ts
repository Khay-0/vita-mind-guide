import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const PROMPT = `Tu es Vita, assistant santé. Génère un RAPPORT DE PRÉPARATION DE RENDEZ-VOUS MÉDICAL clair, structuré et professionnel, en français, au format MARKDOWN.

Structure attendue :

# {Titre du suivi}

## Résumé
(2-3 phrases : nature du problème, durée, ce qui a été constaté)

## Chronologie
(liste à puces des moments-clés avec dates : début, évolutions notables, photos importantes, aggravations / améliorations)

## Symptômes principaux
(liste à puces : intensité moyenne, fréquence, déclencheurs identifiés)

## Évolution ressentie
(courte synthèse basée sur les check-ins : amélioration / stagnation / aggravation, % approximatif si pertinent)

## Traitements / actions essayés
(liste à puces, sinon "Aucun renseigné")

## Questions à poser au médecin
(3 à 5 questions pertinentes et concrètes)

Reste factuel, neutre, et concis. N'invente pas d'informations qui ne sont pas dans les données fournies.`;

export const Route = createFileRoute("/api/visit-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);
        const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
        const { data: claims, error } = await supa.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (error || !userId) return new Response("Unauthorized", { status: 401 });

        const { trackerId } = (await request.json()) as { trackerId: string };
        if (!trackerId) return new Response("Missing trackerId", { status: 400 });

        // Auth-scoped client using the user's token (RLS will gate access)
        const userSupa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );

        const { data: tracker } = await userSupa
          .from("health_trackers")
          .select("*")
          .eq("id", trackerId)
          .maybeSingle();
        if (!tracker) return new Response("Not found", { status: 404 });

        const { data: entries } = await userSupa
          .from("tracker_entries")
          .select("*")
          .eq("tracker_id", trackerId)
          .order("created_at", { ascending: true });

        const { data: messages } = tracker.thread_id
          ? await userSupa
              .from("chat_messages")
              .select("role,content,created_at")
              .eq("thread_id", tracker.thread_id)
              .order("created_at", { ascending: true })
              .limit(30)
          : { data: [] as any[] };

        const summary = `SUIVI : ${tracker.title} ${tracker.emoji ?? ""}
Résumé initial : ${tracker.summary ?? "—"}
Date de début : ${new Date(tracker.created_at).toLocaleDateString("fr-FR")}
Plan initial : ${(Array.isArray(tracker.plan) ? tracker.plan : []).join(" ; ") || "—"}

CHECK-INS (${(entries ?? []).length}) :
${(entries ?? [])
  .map(
    (e: any) =>
      `- ${new Date(e.created_at).toLocaleDateString("fr-FR")} • ressenti ${e.feeling ?? "-"}/5${e.note ? " • " + e.note : ""}${e.photo_url ? " • [photo]" : ""}`,
  )
  .join("\n") || "Aucun"}

EXTRAIT DE CONVERSATION INITIALE :
${(messages ?? [])
  .map((m: any) => `${m.role.toUpperCase()}: ${typeof m.content === "string" ? m.content.slice(0, 400) : "[contenu riche]"}`)
  .join("\n")
  .slice(0, 4000)}`;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: PROMPT },
              { role: "user", content: summary },
            ],
          }),
        });
        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(`AI error: ${t.slice(0, 200)}`, { status: 500 });
        }
        const j = await upstream.json();
        const content: string = j.choices?.[0]?.message?.content ?? "";

        // Persist
        const { data: saved, error: insErr } = await userSupa
          .from("tracker_reports")
          .insert({
            user_id: userId,
            tracker_id: trackerId,
            kind: "visit",
            title: `Préparation RDV — ${tracker.title}`,
            content,
          })
          .select()
          .single();
        if (insErr) return new Response(insErr.message, { status: 500 });

        return new Response(JSON.stringify(saved), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});