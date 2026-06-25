import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CoachIdSchema = z.enum([
  "muscu",
  "nutrition",
  "poids",
  "running",
  "sommeil",
  "hydratation",
]);

async function callGateway(messages: any[], model = "google/gemini-2.5-flash") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY manquante");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("Limite atteinte, réessaie dans un instant.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Erreur IA ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

function parseJson(raw: string): any {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse IA invalide (pas de JSON).");
  return JSON.parse(match[0]);
}

// ===== Save coach onboarding =====
const SaveOnboardingInput = z.object({
  coachId: CoachIdSchema,
  data: z.record(z.string(), z.any()),
});

export const saveCoachOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveOnboardingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("coach_profiles")
      .upsert(
        {
          user_id: userId,
          coach_id: data.coachId,
          onboarding_data: data.data,
          goals: { primary: data.data.goal ?? null },
        },
        { onConflict: "user_id,coach_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Generate workout program =====
const GenWorkoutInput = z.object({
  data: z.record(z.string(), z.any()),
});

export const generateWorkoutProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenWorkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sys = `Tu es Max, coach musculation expert. Tu génères un programme personnalisé sur 4 semaines au format JSON STRICT. Pas de markdown, pas de texte autour, juste le JSON.

Structure:
{
  "name": "<nom court>",
  "weeks": 4,
  "sessions_per_week": <int>,
  "days": [
    { "day": 1, "label": "Push", "focus": "Pectoraux/Épaules/Triceps", "exercises": [
      {"name":"Développé couché","sets":4,"reps":"8-10","rest_sec":120,"notes":"Charge progressive"},
      ...
    ]},
    ...
  ],
  "advice": "<conseil de 1-2 phrases>"
}

Profil:
${JSON.stringify(data.data, null, 2)}

Adapte le nombre d'exercices au matériel et au niveau. 5-7 exercices par séance. Sois précis sur les séries/reps/repos selon l'objectif (force=lourd/peu reps, masse=8-12, endurance=15+).`;

    const raw = await callGateway(
      [
        { role: "system", content: sys },
        { role: "user", content: "Génère mon programme." },
      ],
      "google/gemini-2.5-pro",
    );
    const plan = parseJson(raw);

    // Deactivate previous programs
    await supabase
      .from("workout_programs")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("active", true);

    const { data: program, error } = await supabase
      .from("workout_programs")
      .insert({
        user_id: userId,
        name: plan.name ?? "Mon programme",
        goal: data.data.goal ?? "mass",
        weeks: plan.weeks ?? 4,
        plan,
        active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return program;
  });

// ===== Generate nutrition targets =====
const GenNutritionInput = z.object({
  data: z.record(z.string(), z.any()),
});

export const generateNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenNutritionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const d = data.data;
    const w = Number(d.weight_kg) || 70;
    const h = Number(d.height_cm) || 170;
    const a = Number(d.age) || 30;
    const sex = d.sex === "female" ? -161 : 5;
    const bmr = 10 * w + 6.25 * h - 5 * a + sex;
    const factor =
      { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, very_high: 1.9 }[
        (d.activity as string) || "moderate"
      ] || 1.55;
    let kcal = Math.round(bmr * factor);
    if (d.goal === "lose") kcal -= 400;
    if (d.goal === "gain") kcal += 350;

    const protein_g = Math.round(w * (d.goal === "lose" ? 2 : 1.8));
    const fat_g = Math.round((kcal * 0.25) / 9);
    const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));

    const { data: target, error } = await supabase
      .from("nutrition_targets")
      .upsert(
        { user_id: userId, kcal, protein_g, carbs_g, fat_g },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return target;
  });

// ===== Generate run plan =====
export const generateRunPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenWorkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sys = `Tu es Théo, coach running. Génère un plan d'entraînement personnalisé au format JSON STRICT.
{
  "name":"<nom>",
  "weeks": <int 4-12>,
  "weekly_sessions": [
    {"week":1, "sessions":[
      {"day":"Lundi","type":"endurance fondamentale","duration_min":30,"description":"<courte description>"},
      ...
    ]},
    ...
  ],
  "advice":"<1-2 phrases>"
}

Profil:
${JSON.stringify(data.data, null, 2)}

Pour débutant ou objectif habitude: 8 semaines progressif walk/run.
Pour 5K: 6 semaines. 10K: 8 semaines. Semi: 10 semaines. Marathon: 12 semaines.`;

    const raw = await callGateway(
      [
        { role: "system", content: sys },
        { role: "user", content: "Génère mon plan." },
      ],
      "google/gemini-2.5-pro",
    );
    const plan = parseJson(raw);

    await supabase
      .from("run_plans")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("active", true);

    const { data: rp, error } = await supabase
      .from("run_plans")
      .insert({
        user_id: userId,
        goal: data.data.goal ?? "habit",
        weeks: plan.weeks ?? 8,
        plan,
        active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rp;
  });

// ===== Coach chat (non-streaming, simple) =====
const CoachChatInput = z.object({
  coachId: CoachIdSchema,
  systemPrompt: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.union([z.string(), z.array(z.any())]),
    }),
  ),
});

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CoachChatInput.parse(d))
  .handler(async ({ data }) => {
    const content = await callGateway(
      [{ role: "system", content: data.systemPrompt }, ...data.messages],
      "google/gemini-2.5-flash",
    );
    return { content };
  });

// ===== Award XP =====
const AwardXpInput = z.object({
  eventType: z.string(),
  amount: z.number().int().min(1).max(500),
  refId: z.string().optional(),
});

export const awardXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AwardXpInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: data.eventType,
      amount: data.amount,
      ref_id: data.refId ?? null,
    });
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp")
      .eq("user_id", userId)
      .maybeSingle();
    const newXp = (profile?.xp ?? 0) + data.amount;
    let level = 1;
    while ((level * (level + 1) * 100) / 2 <= newXp) level++;
    await supabase
      .from("profiles")
      .update({ xp: newXp, level })
      .eq("user_id", userId);
    return { xp: newXp, level };
  });
