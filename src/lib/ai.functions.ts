import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============ Schemas ============
const ContentPart = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({ url: z.string() }),
  }),
]);

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(ContentPart)]),
});

const ProfileSchema = z
  .object({
    display_name: z.string().nullable().optional(),
    birthdate: z.string().nullable().optional(),
    sex: z.string().nullable().optional(),
    height_cm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
    allergies: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
  })
  .nullable()
  .optional();

const AskInput = z.object({
  kind: z.enum(["symptom", "question", "checkup"]),
  messages: z.array(Message),
  profile: ProfileSchema,
  generateTitle: z.boolean().optional(),
});

const MoodInput = z.object({
  mood: z.number().int().min(1).max(5),
  profile: ProfileSchema,
});

const AssessmentInput = z.object({
  profile: ProfileSchema,
  recentMoods: z.array(z.number()).optional(),
  activityCount30d: z.number().optional(),
  avgWaterGlasses: z.number().optional(),
});

// ============ Profile block helper ============
function profileBlock(p: z.infer<typeof ProfileSchema>) {
  if (!p) return "Profil utilisateur: non renseigné.";
  const age = p.birthdate
    ? Math.floor((Date.now() - new Date(p.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  return `Profil utilisateur:
- Prénom: ${p.display_name ?? "—"}
- Sexe: ${p.sex ?? "—"}
- Âge: ${age ?? "—"} ans
- Taille: ${p.height_cm ?? "—"} cm
- Poids: ${p.weight_kg ?? "—"} kg
- Allergies: ${(p.allergies ?? []).join(", ") || "aucune connue"}
- Conditions: ${(p.conditions ?? []).join(", ") || "aucune connue"}
- Médicaments: ${(p.medications ?? []).join(", ") || "aucun"}`;
}

// ============ System prompts ============
const DOCTOR_PERSONA = `Tu es Vita, un assistant santé IA expert qui parle comme un médecin généraliste bienveillant, précis et pédagogue. Tu raisonnes PROFONDÉMENT avant de répondre :
1. Identifie les éléments cliniquement pertinents.
2. Envisage plusieurs hypothèses (diagnostic différentiel) du plus probable au moins probable.
3. Repère les signes d'alerte (drapeaux rouges) qui imposent une consultation urgente.
4. Adapte la réponse au profil (âge, sexe, antécédents, traitements, allergies).

TON & STYLE — TRÈS IMPORTANT :
- Écris comme un humain qui parle naturellement, comme une consultation orale. Phrases courtes, fluides, chaleureuses.
- Évite les listes à puces sauf si vraiment nécessaire.
- Tutoie. Empathique, direct, jamais condescendant.
- Ne répète pas une question déjà posée dans la conversation.
- NE DIS JAMAIS "je ne suis pas médecin", "je ne peux pas diagnostiquer", "consulte un professionnel pour confirmer" ou ces disclaimers. Le patient le sait. Va droit au but. Mentionne une consultation UNIQUEMENT en cas de vrai signe d'urgence.
- Termine souvent par UNE question utile pour mieux cerner la situation.

ANALYSE D'IMAGE — OBLIGATOIRE :
Quand une image est jointe au message, tu DOIS l'analyser visuellement en détail : décris ce que tu vois (couleur, forme, taille, texture, localisation), propose les hypothèses les plus probables et donne une recommandation concrète. N'écris JAMAIS "je ne peux pas analyser d'image" — tu en es capable.

SIGNAL PHOTO :
Si le motif évoque une lésion visible (rougeur, éruption, plaie, gonflement, œil, gorge, ongle, peau…) ET qu'aucune photo n'a encore été partagée, termine ta réponse par exactement ce marqueur sur sa propre ligne : [[ASK_PHOTO]]
Sinon, n'ajoute jamais ce marqueur.`;

function systemPrompt(kind: "symptom" | "question" | "checkup", profile: string, withTitle: boolean) {
  let body = `${DOCTOR_PERSONA}\n\n${profile}`;
  if (kind === "symptom") {
    body += `\n\nMODE — Analyse de symptômes : reformule brièvement, pose une question de clarification si nécessaire (une seule), puis livre 2-4 causes possibles avec, pour chacune, un mot sur ce qui irait dans son sens. Termine par une recommandation claire (auto-soins / pharmacien / médecin / urgences).`;
  } else if (kind === "checkup") {
    body += `\n\nMODE — Bilan complet : produis une analyse personnalisée, en paragraphes fluides, qui couvre les forces, les risques potentiels et 3 actions prioritaires pour cette semaine.`;
  } else {
    body += `\n\nMODE — Question libre : réponds de façon claire, précise et structurée. Si la question dépasse ton champ, redirige vers un professionnel.`;
  }
  if (withTitle) {
    body += `\n\nTITRE DE CONVERSATION : sur la TOUTE PREMIÈRE ligne de ta réponse, écris exactement: [[TITLE: <titre court de 3-6 mots résumant le sujet>]] puis saute une ligne et commence ta vraie réponse. N'inclus cette ligne QUE pour le tout premier message de la conversation.`;
  }
  return body;
}

// ============ Gateway call ============
async function callGateway(messages: any[], model = "google/gemini-2.5-pro") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY manquante");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("Limite atteinte, réessaie dans un instant.");
  if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoute des crédits à ton workspace.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Erreur IA ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

// ============ askHealthAi ============
export const askHealthAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data }) => {
    const raw = await callGateway([
      { role: "system", content: systemPrompt(data.kind, profileBlock(data.profile), data.generateTitle ?? false) },
      ...data.messages,
    ]);

    // Parse title
    let title: string | null = null;
    let content = raw;
    const titleMatch = content.match(/^\s*\[\[TITLE:\s*(.+?)\]\]\s*\n?/i);
    if (titleMatch) {
      title = titleMatch[1].trim().slice(0, 80);
      content = content.slice(titleMatch[0].length).trim();
    }

    // Parse photo signal
    let askPhoto = false;
    if (/\[\[ASK_PHOTO\]\]/i.test(content)) {
      askPhoto = true;
      content = content.replace(/\[\[ASK_PHOTO\]\]/gi, "").trim();
    }

    return { content, title, askPhoto };
  });

// ============ moodReaction (popup IA après le smiley) ============
export const moodReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MoodInput.parse(d))
  .handler(async ({ data }) => {
    const moodLabel = ["très mal", "pas très bien", "neutre", "bien", "excellent"][data.mood - 1];
    const sys = `Tu es Vita, coach santé bienveillant qui parle français. Le patient vient d'indiquer qu'il se sent "${moodLabel}" aujourd'hui.
- S'il se sent bien ou excellent : félicite-le chaleureusement en UNE phrase, puis donne UN conseil simple pour entretenir cette énergie (3 phrases max au total). Ton chaleureux, presque amical.
- S'il se sent neutre : encourage doucement, propose UNE micro-action concrète à faire dans la journée (3 phrases max).
- S'il se sent mal ou très mal : commence par valider l'émotion sans minimiser, puis donne UN conseil immédiat et concret (respiration, hydratation, marche, parler à quelqu'un). Si très mal, rappelle qu'on peut appeler un proche ou le 3114 en France. 4 phrases max.
Adapte le tutoiement. Pas de liste à puces. Réponse courte, humaine, comme un ami qui prend des nouvelles.\n\n${profileBlock(data.profile)}`;
    const content = await callGateway(
      [
        { role: "system", content: sys },
        { role: "user", content: `Je me sens ${moodLabel}.` },
      ],
      "google/gemini-2.5-flash",
    );
    return { content };
  });

// ============ generateAssessment (bilan structuré JSON) ============
export const generateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssessmentInput.parse(d))
  .handler(async ({ data }) => {
    const p = data.profile;
    const bmiVal =
      p?.height_cm && p?.weight_kg ? p.weight_kg / Math.pow(p.height_cm / 100, 2) : null;
    const context = `${profileBlock(p)}
Données comportementales récentes :
- Humeur moyenne (1-5) sur 7 derniers jours : ${data.recentMoods?.length ? (data.recentMoods.reduce((a, b) => a + b, 0) / data.recentMoods.length).toFixed(1) : "—"}
- Nombre d'activités physiques sur 30 jours : ${data.activityCount30d ?? "—"}
- Verres d'eau moyens par jour : ${data.avgWaterGlasses?.toFixed(1) ?? "—"}
- IMC calculé : ${bmiVal?.toFixed(1) ?? "—"}`;

    const sys = `Tu es un médecin généraliste qui produit un bilan de santé synthétique. Tu réponds UNIQUEMENT par un objet JSON valide, sans markdown, sans texte autour. Structure exacte :
{
  "overall_score": <0-100>,
  "cardio_score": <0-100>,
  "nutrition_score": <0-100>,
  "sleep_score": <0-100>,
  "mental_score": <0-100>,
  "activity_score": <0-100>,
  "strengths": ["...","...","..."],
  "risks": ["...","...","..."],
  "priority_actions": ["...","...","..."],
  "summary": "<résumé chaleureux et motivant en 2-3 phrases>"
}
Les scores reflètent la santé réelle estimée à partir du profil et des données. strengths/risks/priority_actions doivent être courts (1 phrase chacun), concrets, personnalisés.`;
    const raw = await callGateway(
      [
        { role: "system", content: sys },
        { role: "user", content: context },
      ],
      "google/gemini-2.5-pro",
    );

    // Robust JSON parse
    let json: any;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      json = JSON.parse(m ? m[0] : raw);
    } catch {
      throw new Error("Bilan: format de réponse invalide.");
    }
    return {
      ...json,
      bmi: bmiVal,
    };
  });
