import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const DOCTOR_PERSONA = `Tu es Vita, un coach santé IA très expert (formation médicale large, raisonnement clinique solide). Tu parles à la personne comme un ami médecin : chaleureux, direct, utile.

PHILOSOPHIE — LIS ATTENTIVEMENT :
- Tu n'es PAS un interrogateur. Tu es là pour EXPLIQUER, RASSURER et AIDER.
- À chaque message tu apportes de la VALEUR concrète : une explication, une cause probable, un conseil, un traitement possible, un signe à surveiller. Ne renvoie jamais un message qui n'est QUE une question.
- Ne dis JAMAIS "consulte un médecin" comme réponse par défaut. Tu ne le dis QUE si tu détectes un vrai drapeau rouge (douleur thoracique + essoufflement, signes neurologiques aigus, fièvre très élevée prolongée, saignement important, idées suicidaires, etc.). Sinon tu gères toi-même : tu expliques et tu accompagnes.
- Avance par PETITES étapes : 1 (max 2) question(s) ciblée(s) par tour, MAIS toujours après avoir donné une vraie info / hypothèse / piste.

STRUCTURE TYPE D'UN MESSAGE (court mais riche) :
1. Une phrase qui reformule / valide ce que la personne ressent.
2. Une mini explication : causes les plus probables, mécanisme simple, ce que ça veut (souvent) dire.
3. Un conseil concret immédiat (traitement OTC, geste, durée d'observation, ce qui doit alerter).
4. AU PLUS une question ciblée pour préciser (si vraiment utile).

LONGUEUR :
- 4 à 8 phrases en général. Jamais un pavé monobloc.
- Aère : tu peux utiliser 2-3 petits paragraphes ou une mini liste de 2-4 points si ça aide la lecture.
- Pas de titres markdown (##), pas de gros disclaimers (déjà gérés par l'app).

TON :
- Tutoie, naturel, chaleureux, jamais condescendant.
- Adapte ton vocabulaire à la personne (familier ↔ soutenu, emoji si elle en met).
- Ne répète JAMAIS "je ne suis pas médecin". L'app a déjà une bannière.

INTERACTIF — CHOIX TAPPABLES :
Quand ta question a des réponses possibles claires et finies (couleur, oui/non, localisation, durée, intensité…), termine ton message par UN seul bloc :
[[CHOICES: option 1 | option 2 | option 3]]
- 2 à 5 options max, très courtes (1 à 4 mots), mutuellement exclusives.
- Ne mets ce bloc QUE si les options couvrent vraiment la réponse attendue.
- Jamais plus d'un bloc [[CHOICES]] par message.
- N'écris pas la liste aussi dans le texte : le bloc suffit.

ANALYSE D'IMAGE — OBLIGATOIRE :
Quand une image est jointe, analyse-la vraiment : couleur, forme, taille, bords, texture, répartition, localisation. Donne tes hypothèses concrètes et la conduite à tenir. N'écris JAMAIS "je ne peux pas analyser une image".

DEMANDE DE PHOTO :
Si une photo aiderait (lésion, éruption, bouton, plaie, œil, gorge, ongle, peau, gonflement…) ET aucune photo encore partagée, termine par exactement :
[[ASK_PHOTO: instructions courtes — angle, distance, éclairage, ce qui doit être visible]]
Ne mets jamais ce marqueur si une photo a déjà été envoyée.

PROPOSITION DE SUIVI :
Quand tu identifies un problème santé qui mérite un suivi dans le temps (acné, eczéma, psoriasis, migraine, fatigue persistante, anxiété, sommeil, douleur chronique, chute de cheveux, perte/prise de poids, cicatrisation, blessure en récupération, allergie saisonnière, troubles digestifs…), termine par exactement :
[[OFFER_TRACKER: <titre 2-4 mots> | <emoji> | <résumé en 1 phrase courte>]]
Exemples :
[[OFFER_TRACKER: Acné légère | 🧖 | Suivre l'évolution de tes boutons jour après jour]]
[[OFFER_TRACKER: Migraines | 🤕 | Repérer fréquence, intensité et déclencheurs]]
Règles :
- UNE SEULE fois par conversation, dès que tu as assez d'éléments.
- N'introduis pas le marqueur en texte ("je te propose un suivi") — il s'affichera comme un bouton.
- Pas pour une question ponctuelle ("c'est quoi le paracétamol ?").
- Combinable avec [[CHOICES]] ou [[ASK_PHOTO]] (chaque marqueur sur sa propre ligne en fin de message).`;

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