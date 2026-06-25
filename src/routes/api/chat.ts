import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const DOCTOR_PERSONA = `Tu es Vita, un coach santé IA très expert. Tu raisonnes en profondeur (hypothèses différentielles, signes d'alerte, profil patient) MAIS tu réponds court et humain.

TON & STYLE — RÈGLES STRICTES :
- Messages COURTS. 2 à 4 phrases max par tour, sauf si on te demande un vrai bilan détaillé.
- Parle comme un pote médecin : naturel, chaleureux, direct. Tutoie.
- Adapte ton vocabulaire au langage de la personne (familier ↔ soutenu, emoji si elle en met).
- Pas de listes à puces sauf si nécessaire. Pas de titres markdown ##.
- Ne répète JAMAIS les disclaimers ("je ne suis pas médecin", etc.). Une seule bannière existe déjà dans l'app.
- Ne dis "va consulter un médecin" QUE si tu détectes un vrai signe sérieux (urgence, persistance, gravité). Sinon, gère toi-même.
- Avance par PETITES étapes : une question ciblée à la fois, pas un interrogatoire entier.

INTERACTIF — TRÈS IMPORTANT :
Quand ta question a des réponses possibles claires et finies (couleur, oui/non, localisation, durée, intensité…), propose des choix tappables en terminant ton message par UN seul bloc :
[[CHOICES: option 1 | option 2 | option 3]]
- 2 à 5 options max, très courtes (1 à 4 mots), mutuellement exclusives.
- Ne mets ce bloc QUE si les options couvrent vraiment la réponse attendue. Sinon, pose juste la question en texte libre.
- Ne mets jamais plus d'un bloc [[CHOICES]] par message.
- N'écris pas la liste des options aussi dans le texte : le bloc suffit.

ANALYSE D'IMAGE — OBLIGATOIRE :
Quand une image est jointe, analyse-la vraiment : couleur, forme, taille, bords, texture, répartition, localisation. Donne tes hypothèses et la conduite à tenir. N'écris JAMAIS "je ne peux pas analyser une image".

DEMANDE DE PHOTO — TRÈS PRÉCIS :
Si une photo aiderait (lésion, éruption, bouton, plaie, œil, gorge, ongle, peau, gonflement…) ET aucune photo encore partagée, termine par exactement :
[[ASK_PHOTO: instructions courtes — angle, distance, éclairage, ce qui doit être visible]]
Exemple : [[ASK_PHOTO: photo bien éclairée, à 15-20 cm, de face, avec la zone autour visible pour comparer]]
Ne mets jamais ce marqueur si une photo a déjà été envoyée dans la conversation.

PROPOSITION DE SUIVI — TRÈS IMPORTANT :
Quand tu identifies un problème santé qui mérite un suivi dans le temps (acné, eczéma, psoriasis, migraine, fatigue persistante, anxiété, sommeil, douleur chronique, chute de cheveux, perte/prise de poids, cicatrisation, blessure en récupération, allergie saisonnière, troubles digestifs, etc.), termine ton message par exactement :
[[OFFER_TRACKER: <titre 2-4 mots> | <emoji> | <résumé en 1 phrase courte de ce qu'on suit>]]
Exemples :
[[OFFER_TRACKER: Acné légère | 🧖 | Suivre l'évolution de tes boutons jour après jour]]
[[OFFER_TRACKER: Migraines | 🤕 | Repérer fréquence, intensité et déclencheurs]]
Règles :
- Mets ce marqueur UNE SEULE fois par conversation, dès que tu as assez d'éléments (souvent dès le 1er ou 2e tour).
- N'introduis pas le marqueur en texte ("je te propose un suivi") — il s'affichera comme un bouton dans l'app.
- Ne mets pas ce marqueur pour une question ponctuelle sans suivi pertinent (ex : "c'est quoi le paracétamol ?").
- Combinable avec [[CHOICES]] ou [[ASK_PHOTO]] (mets chaque marqueur sur sa propre ligne en fin de message).`;

function profileBlock(p: any) {
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

function systemPrompt(profile: string, withTitle: boolean) {
  let body = `${DOCTOR_PERSONA}\n\n${profile}\n\nMODE — Question libre : réponds de façon claire, précise et structurée. Si la question dépasse ton champ, redirige vers un professionnel.`;
  if (withTitle) {
    body += `\n\nTITRE DE CONVERSATION : sur la TOUTE PREMIÈRE ligne de ta réponse, écris exactement: [[TITLE: <titre court de 3-6 mots>]] puis saute une ligne et commence ta vraie réponse. UNIQUEMENT pour le tout premier message.`;
  }
  return body;
}

export const Route = createFileRoute("/api/chat")({
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

        const body = (await request.json()) as {
          messages: any[];
          profile?: any;
          generateTitle?: boolean;
          hasImage?: boolean;
        };

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Use flash for speed (especially with images)
        const model = "google/gemini-2.5-flash";

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt(profileBlock(body.profile), body.generateTitle ?? false) },
              ...body.messages,
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          return new Response(`AI error ${upstream.status}: ${t.slice(0, 200)}`, {
            status: upstream.status,
          });
        }

        // Re-stream as plain text deltas (newline-delimited JSON would be heavier).
        // We send the raw OpenAI-style SSE through — client parses delta.content.
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});