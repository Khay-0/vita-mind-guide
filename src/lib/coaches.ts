import muscuImg from "@/assets/coach-muscu.png";
import nutritionImg from "@/assets/coach-nutrition.png";
import poidsImg from "@/assets/coach-poids.png";
import runningImg from "@/assets/coach-running.png";
import sommeilImg from "@/assets/coach-sommeil.png";
import hydratationImg from "@/assets/coach-hydratation.png";

export type CoachId =
  | "muscu"
  | "nutrition"
  | "poids"
  | "running"
  | "sommeil"
  | "hydratation";

export type OnboardingField = {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  unit?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type CoachMeta = {
  id: CoachId;
  name: string;
  fullName: string;
  tagline: string;
  mascot: string;
  gradient: string;
  accent: string;
  checkinFrequencyDays: number;
  onboarding: OnboardingField[];
  systemPrompt: string;
  programType: "workout" | "nutrition" | "weight" | "run" | "sleep" | "hydration";
};

export const COACHES: Record<CoachId, CoachMeta> = {
  muscu: {
    id: "muscu",
    name: "Max",
    fullName: "Max — Coach Musculation",
    tagline: "Programmes, charges, progression",
    mascot: muscuImg,
    gradient: "from-orange-500 to-rose-600",
    accent: "#f97316",
    checkinFrequencyDays: 7,
    programType: "workout",
    onboarding: [
      { key: "age", label: "Âge", type: "number", unit: "ans" },
      {
        key: "sex",
        label: "Sexe",
        type: "select",
        options: [
          { value: "male", label: "Homme" },
          { value: "female", label: "Femme" },
        ],
      },
      { key: "height_cm", label: "Taille", type: "number", unit: "cm" },
      { key: "weight_kg", label: "Poids actuel", type: "number", unit: "kg" },
      {
        key: "experience",
        label: "Expérience",
        type: "select",
        options: [
          { value: "beginner", label: "Débutant (0-6 mois)" },
          { value: "intermediate", label: "Intermédiaire (6 mois - 2 ans)" },
          { value: "advanced", label: "Avancé (2 ans+)" },
        ],
      },
      {
        key: "equipment",
        label: "Matériel disponible",
        type: "select",
        options: [
          { value: "gym", label: "Salle complète" },
          { value: "home_full", label: "Maison équipée (barre + halt.)" },
          { value: "home_min", label: "Maison minimale (halt. ou rien)" },
          { value: "bodyweight", label: "Poids du corps uniquement" },
        ],
      },
      {
        key: "goal",
        label: "Objectif principal",
        type: "select",
        options: [
          { value: "mass", label: "Prise de masse" },
          { value: "cut", label: "Sèche" },
          { value: "recomp", label: "Recomposition" },
          { value: "strength", label: "Force" },
          { value: "endurance", label: "Endurance" },
        ],
      },
      {
        key: "sessions_per_week",
        label: "Séances / semaine",
        type: "number",
      },
    ],
    systemPrompt: `Tu es Max, coach musculation expert, direct et motivant. Tu tutoies. Tu connais l'anatomie, la périodisation, les charges, les techniques d'intensification. Tu réponds en 2-4 phrases max sauf si on te demande un détail technique. Tu ne donnes JAMAIS de conseils médicaux — c'est le rôle de Vita IA. Tu te concentres sur l'entraînement, la récupération, la progression. Encourage, sois précis sur les exercices, séries, reps, repos.`,
  },
  nutrition: {
    id: "nutrition",
    name: "Léo",
    fullName: "Léo — Coach Nutrition",
    tagline: "Calories, macros, repas",
    mascot: nutritionImg,
    gradient: "from-emerald-500 to-teal-600",
    accent: "#10b981",
    checkinFrequencyDays: 1,
    programType: "nutrition",
    onboarding: [
      { key: "age", label: "Âge", type: "number", unit: "ans" },
      {
        key: "sex",
        label: "Sexe",
        type: "select",
        options: [
          { value: "male", label: "Homme" },
          { value: "female", label: "Femme" },
        ],
      },
      { key: "height_cm", label: "Taille", type: "number", unit: "cm" },
      { key: "weight_kg", label: "Poids", type: "number", unit: "kg" },
      {
        key: "activity",
        label: "Niveau d'activité",
        type: "select",
        options: [
          { value: "sedentary", label: "Sédentaire" },
          { value: "light", label: "Léger (1-3x/sem)" },
          { value: "moderate", label: "Modéré (3-5x/sem)" },
          { value: "high", label: "Élevé (6-7x/sem)" },
          { value: "very_high", label: "Très élevé (2x/jour)" },
        ],
      },
      {
        key: "goal",
        label: "Objectif",
        type: "select",
        options: [
          { value: "lose", label: "Perdre du gras" },
          { value: "maintain", label: "Maintenir" },
          { value: "gain", label: "Prendre du muscle" },
        ],
      },
    ],
    systemPrompt: `Tu es Léo, coach nutrition expert et chaleureux. Tu tutoies. Tu réponds court (2-4 phrases). Tu connais les macros, l'index glycémique, les régimes (cétogène, méditerranéen, flexitarien…). Tu ne donnes JAMAIS de conseil médical (Vita IA s'en charge). Tu te concentres sur les repas, les calories, les macros, les idées de menus. Sois pragmatique et bienveillant.`,
  },
  poids: {
    id: "poids",
    name: "Sofia",
    fullName: "Sofia — Coach Perte de Poids",
    tagline: "Plan progressif, régularité",
    mascot: poidsImg,
    gradient: "from-pink-500 to-fuchsia-600",
    accent: "#ec4899",
    checkinFrequencyDays: 3,
    programType: "weight",
    onboarding: [
      { key: "age", label: "Âge", type: "number", unit: "ans" },
      {
        key: "sex",
        label: "Sexe",
        type: "select",
        options: [
          { value: "male", label: "Homme" },
          { value: "female", label: "Femme" },
        ],
      },
      { key: "height_cm", label: "Taille", type: "number", unit: "cm" },
      { key: "weight_kg", label: "Poids actuel", type: "number", unit: "kg" },
      { key: "target_kg", label: "Poids objectif", type: "number", unit: "kg" },
      {
        key: "pace",
        label: "Rythme souhaité",
        type: "select",
        options: [
          { value: "slow", label: "Doux (0,3 kg/sem)" },
          { value: "normal", label: "Normal (0,5 kg/sem)" },
          { value: "fast", label: "Rapide (0,7 kg/sem)" },
        ],
      },
    ],
    systemPrompt: `Tu es Sofia, coach perte de poids bienveillante et motivante. Tu tutoies. Tu réponds en 2-4 phrases. Tu te concentres sur la régularité, les petites victoires, la mentalité. Pas de conseil médical. Encourage la régularité plus que la performance. Rappelle que la perte de poids est un marathon, pas un sprint.`,
  },
  running: {
    id: "running",
    name: "Théo",
    fullName: "Théo — Coach Running",
    tagline: "Plans 5K, 10K, semi, marathon",
    mascot: runningImg,
    gradient: "from-sky-500 to-blue-600",
    accent: "#0ea5e9",
    checkinFrequencyDays: 7,
    programType: "run",
    onboarding: [
      { key: "age", label: "Âge", type: "number", unit: "ans" },
      {
        key: "level",
        label: "Niveau actuel",
        type: "select",
        options: [
          { value: "none", label: "Je ne cours pas encore" },
          { value: "beginner", label: "Débutant (<10 km/sem)" },
          { value: "regular", label: "Régulier (10-30 km/sem)" },
          { value: "advanced", label: "Avancé (>30 km/sem)" },
        ],
      },
      {
        key: "goal",
        label: "Objectif",
        type: "select",
        options: [
          { value: "habit", label: "Prendre l'habitude" },
          { value: "5k", label: "5 km" },
          { value: "10k", label: "10 km" },
          { value: "semi", label: "Semi-marathon" },
          { value: "marathon", label: "Marathon" },
        ],
      },
      {
        key: "sessions_per_week",
        label: "Séances par semaine",
        type: "number",
      },
    ],
    systemPrompt: `Tu es Théo, coach running passionné. Tu tutoies. Réponses courtes (2-4 phrases). Tu maîtrises VMA, fractionné, endurance fondamentale, allure spécifique. Pas de conseil médical. Concentre-toi sur les plans, allures, récupération, mental de coureur.`,
  },
  sommeil: {
    id: "sommeil",
    name: "Luna",
    fullName: "Luna — Coach Sommeil",
    tagline: "Routine, qualité, énergie",
    mascot: sommeilImg,
    gradient: "from-indigo-500 to-purple-700",
    accent: "#8b5cf6",
    checkinFrequencyDays: 1,
    programType: "sleep",
    onboarding: [
      {
        key: "target_bedtime",
        label: "Heure de coucher cible",
        type: "text",
        placeholder: "23:00",
      },
      {
        key: "target_wake",
        label: "Heure de réveil cible",
        type: "text",
        placeholder: "07:00",
      },
      { key: "target_hours", label: "Heures visées", type: "number", unit: "h" },
      {
        key: "main_issue",
        label: "Problème principal",
        type: "select",
        options: [
          { value: "fall", label: "Difficulté à m'endormir" },
          { value: "wake", label: "Réveils nocturnes" },
          { value: "quality", label: "Mauvaise qualité" },
          { value: "duration", label: "Pas assez d'heures" },
          { value: "none", label: "Aucun, je veux optimiser" },
        ],
      },
    ],
    systemPrompt: `Tu es Luna, coach sommeil douce et apaisante. Tu tutoies. Réponses courtes (2-4 phrases), ton calme. Tu connais le rythme circadien, la mélatonine, l'hygiène de sommeil. Pas de conseil médical. Concentre-toi sur la routine, l'environnement, la respiration, la lumière.`,
  },
  hydratation: {
    id: "hydratation",
    name: "Aqua",
    fullName: "Aqua — Coach Hydratation",
    tagline: "Boire suffisamment chaque jour",
    mascot: hydratationImg,
    gradient: "from-cyan-500 to-sky-600",
    accent: "#06b6d4",
    checkinFrequencyDays: 1,
    programType: "hydration",
    onboarding: [
      { key: "weight_kg", label: "Poids", type: "number", unit: "kg" },
      {
        key: "activity",
        label: "Activité physique quotidienne",
        type: "select",
        options: [
          { value: "low", label: "Faible" },
          { value: "moderate", label: "Modérée" },
          { value: "high", label: "Élevée" },
        ],
      },
      {
        key: "climate",
        label: "Climat",
        type: "select",
        options: [
          { value: "temperate", label: "Tempéré" },
          { value: "hot", label: "Chaud" },
          { value: "very_hot", label: "Très chaud" },
        ],
      },
    ],
    systemPrompt: `Tu es Aqua, coach hydratation pétillante et enjouée. Tu tutoies. Réponses ultra-courtes (1-3 phrases). Tu rappelles l'importance de boire, donnes des astuces simples pour penser à s'hydrater.`,
  },
};

export const COACH_LIST: CoachMeta[] = Object.values(COACHES);

// XP level formula: level n requires (n*(n-1)/2) * 100 XP total
export function levelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
} {
  let level = 1;
  while ((level * (level + 1) * 100) / 2 <= xp) level++;
  const currentLevelXp = ((level - 1) * level * 100) / 2;
  const nextLevelXp = (level * (level + 1) * 100) / 2;
  const progress =
    nextLevelXp > currentLevelXp
      ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
      : 0;
  return { level, currentLevelXp, nextLevelXp, progress };
}

export const XP_REWARDS = {
  tracker_checkin: 15,
  photo_added: 20,
  goal_reached: 50,
  weekly_completed: 75,
  workout_logged: 25,
  meal_logged: 10,
  sleep_logged: 10,
  run_logged: 30,
  coach_onboarded: 40,
  measurement_logged: 15,
} as const;

export type XpEventType = keyof typeof XP_REWARDS;
