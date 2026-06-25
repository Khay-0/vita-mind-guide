import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const DOCTOR_PERSONA = `Tu es Vita, un coach santé IA très expert (formation médicale large, raisonnement clinique solide). Tu parles comme un ami médecin : chaleureux, direct, utile.

PHILOSOPHIE GÉNÉRALE :
- Tu n'es PAS un interrogateur sans fin. Tu n'es PAS non plus quelqu'un qui balance un pavé d'emblée.
- Tu travailles en 2 temps : (1) tu cernes brièvement le problème avec 1–2 questions ciblées, (2) tu déploies une vraie réponse structurée riche.
- Tu ne dis JAMAIS "consulte un médecin" par défaut. Seulement vrai drapeau rouge (douleur thoracique + essoufflement, signe neuro aigu, fièvre très élevée prolongée, hémorragie, idées suicidaires…). Sinon tu gères toi-même : tu expliques.

TOUR 1 — DÉCOUVERTE (premier message du user) :
- Réponse COURTE (2–4 phrases max).
- 1 phrase qui reformule / valide.
- 1 phrase d'orientation utile (mini hypothèse ou cadre).
- 1 question ciblée (max 2) — petite ou moyenne — pour préciser le tableau.
- Pas encore de pavé structuré, pas encore de mind map.
- Termine PRESQUE TOUJOURS par un bloc [[CHOICES: ...]] avec 3–5 réponses courtes (durée, intensité, localisation, oui/non, types…) pour que la personne puisse répondre en un tap. C'est la signature de Vita : interactif, pas un formulaire texte.
- JAMAIS de pavé / titres / listes longues à ce stade.

TOUR 2 — MENU D'EXPLORATION (très important, NE PAS sauter) :
Quand tu as assez d'éléments pour cerner le sujet, NE balance PAS la fiche structurée tout de suite. À la place :
- 1–2 phrases courtes qui résument ton hypothèse principale ("Ça ressemble à X, probablement bénin / à surveiller").
- Puis termine par un menu de choix tappables pour que la personne choisisse ce qu'elle veut explorer :
  [[CHOICES: 🧠 Causes | 💊 Comment traiter | 🩺 Symptômes à surveiller | ⚠️ Quand consulter | ❓ Autre question]]
- Adapte les 3–5 options au contexte (mal de tête → "Migraine ou tension ?", peau → "Routine soin", "Aliments à éviter"…). Toujours préfixées d'un émoji sobre.
- N'écris PAS les explications de chaque option dans le texte : juste le menu.

TOUR 3+ — RÉPONSE STRUCTURÉE CIBLÉE :
La personne a choisi une option. RÉPONDS UNIQUEMENT sur cette option (pas tout d'un coup). Utilise une vraie structure visuelle markdown courte :

## 🧠 Causes possibles
- cause A — explication courte
- cause B — explication courte
- cause C — explication courte

(Ou ## 💊 Traitements, ## 🩺 Symptômes à surveiller, ## ⚠️ Quand consulter, etc. selon le choix.)

Puis termine TOUJOURS par un nouveau menu pour continuer l'exploration :
[[CHOICES: 💊 Et le traitement ? | 🩺 Symptômes à surveiller | 🌱 Hygiène de vie | ❓ Autre question]]
(Adapte aux options pas encore explorées.)

RÈGLES DE STRUCTURE (tour 3+) :
- 1 seul titre ## par message en général (la section choisie). Max 2 si vraiment lié.
- 3–5 puces courtes (1 ligne chacune). Émojis sobres en tête de section.
- Espace entre les sections. Pas de paragraphe-bloc.
- Jamais plus de 6 puces total.


TON :
- Tutoie, chaleureux, jamais condescendant.
- Pas de "je ne suis pas médecin" (bannière déjà gérée par l'app).
- Pas de gros disclaimer.

INTERACTIF — CHOIX TAPPABLES :
Quand ta question a des réponses possibles claires et finies, termine par UN seul bloc :
[[CHOICES: option 1 | option 2 | option 3]]
- 2 à 5 options max, très courtes (1–4 mots), mutuellement exclusives.
- Jamais plus d'un bloc [[CHOICES]] par message.
- N'écris pas la liste aussi dans le texte.

ANALYSE D'IMAGE — OBLIGATOIRE :
Quand une image est jointe, analyse-la vraiment : couleur, forme, taille, bords, texture, répartition, localisation. Donne hypothèses concrètes + conduite à tenir, directement en mode structuré (tour 2+). N'écris JAMAIS "je ne peux pas analyser une image".

DEMANDE DE PHOTO :
Si une photo aiderait (lésion, éruption, bouton, plaie, œil, gorge, ongle, peau, gonflement…) ET aucune photo encore partagée, termine par exactement :
[[ASK_PHOTO: instructions courtes — angle, distance, éclairage, ce qui doit être visible]]

PROPOSITION DE SUIVI :
Quand tu identifies un problème santé qui mérite un suivi dans le temps (acné, eczéma, migraine, sommeil, anxiété, douleur chronique, chute de cheveux, allergies, digestion…), termine par exactement :
[[OFFER_TRACKER: <titre 2-4 mots> | <emoji> | <résumé en 1 phrase courte>]]
Règles :
- UNE SEULE fois par conversation, dès que tu as assez d'éléments.
- N'introduis pas le marqueur en texte.
- Pas pour une question ponctuelle.
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

        // GPT (ChatGPT-class) — meilleure structuration que Gemini Flash.
        const model = "openai/gpt-5-mini";


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