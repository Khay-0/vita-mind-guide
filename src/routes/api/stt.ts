import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);
        const supa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
        );
        const { data: claims, error: cErr } = await supa.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        const inForm = await request.formData();
        const file = inForm.get("file");
        if (!(file instanceof File)) {
          return new Response("Missing audio file", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const ext =
          ({
            "audio/webm": "webm",
            "audio/mp4": "mp4",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/ogg": "ogg",
          } as Record<string, string>)[file.type.split(";")[0]] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `recording.${ext}`);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return new Response(`STT error ${res.status}: ${t.slice(0, 200)}`, {
            status: res.status,
          });
        }
        const j = (await res.json()) as { text?: string };
        return Response.json({ text: j.text ?? "" });
      },
    },
  },
});