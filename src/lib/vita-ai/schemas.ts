import { z } from "zod";

// ============================================================
// Vita AI — Single source of truth for the structured response.
// Client + server import from here. No prompt strings here.
// ============================================================

export const UrgencySchema = z.enum(["low", "moderate", "high", "emergency"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const StageSchema = z.enum([
  "discovery",
  "clarification",
  "orientation",
  "action_plan",
  "follow_up",
  "emergency",
  "info", // direct answer to a general/non-clinical question
]);
export type Stage = z.infer<typeof StageSchema>;

export const QuickReplySchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(200),
  icon: z.string().max(16).optional(),
});

// ---------- Cards ----------
const PossibleCausesCard = z.object({
  type: z.literal("possible_causes"),
  title: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        likelihood: z.enum(["more_likely", "possible", "less_likely"]),
        reason: z.string().min(1).max(280),
      }),
    )
    .min(1)
    .max(6),
});

const ActionPlanCard = z.object({
  type: z.literal("action_plan"),
  title: z.string().min(1).max(120),
  actions: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(280),
        timeframe: z.string().max(60).optional(),
        completed: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(8),
});

const WarningSignsCard = z.object({
  type: z.literal("warning_signs"),
  title: z.string().min(1).max(120),
  signs: z.array(z.string().min(1).max(200)).min(1).max(8),
});

const MeasurementCard = z.object({
  type: z.literal("measurement"),
  metric: z.string().min(1).max(60),
  question: z.string().min(1).max(200),
  inputType: z.enum(["number", "scale", "duration", "yes_no"]),
  unit: z.string().max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const TimelineCard = z.object({
  type: z.literal("timeline"),
  title: z.string().min(1).max(120),
  events: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        date: z.string().max(40).optional(),
        status: z.enum(["past", "current", "next"]),
      }),
    )
    .min(1)
    .max(8),
});

const ComparisonCard = z.object({
  type: z.literal("comparison"),
  title: z.string().min(1).max(120),
  columns: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        points: z.array(z.string().min(1).max(200)).min(1).max(6),
      }),
    )
    .min(2)
    .max(3),
});

const PhotoRequestCard = z.object({
  type: z.literal("photo_request"),
  title: z.string().min(1).max(120),
  instructions: z.array(z.string().min(1).max(200)).min(1).max(5),
});

const BodyLocationCard = z.object({
  type: z.literal("body_location"),
  title: z.string().min(1).max(120),
  instructions: z.string().min(1).max(280),
});

const TrackerOfferCard = z.object({
  type: z.literal("tracker_offer"),
  title: z.string().min(1).max(60),
  emoji: z.string().max(8),
  summary: z.string().min(1).max(200),
  suggestedDurationDays: z.number().int().min(1).max(60),
});

export const CardSchema = z.discriminatedUnion("type", [
  PossibleCausesCard,
  ActionPlanCard,
  WarningSignsCard,
  MeasurementCard,
  TimelineCard,
  ComparisonCard,
  PhotoRequestCard,
  BodyLocationCard,
  TrackerOfferCard,
]);
export type VitaCard = z.infer<typeof CardSchema>;

export const MemorySuggestionSchema = z.object({
  category: z.enum([
    "symptom",
    "allergy",
    "condition",
    "medication",
    "goal",
    "preference",
    "habit",
  ]),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(280),
  sensitive: z.boolean(),
});
export type MemorySuggestion = z.infer<typeof MemorySuggestionSchema>;

export const SuggestedActionSchema = z.enum([
  "take_photo",
  "open_body_picker",
  "start_tracker",
  "save_memory",
  "open_profile",
  "call_emergency",
]);
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const VitaResponseSchema = z.object({
  message: z.string().min(1).max(2000),
  stage: StageSchema,
  urgency: UrgencySchema,
  title: z.string().min(1).max(80).optional(), // generated on first message
  quickReplies: z.array(QuickReplySchema).max(6).optional(),
  cards: z.array(CardSchema).max(4).optional(),
  memorySuggestions: z.array(MemorySuggestionSchema).max(3).optional(),
  suggestedActions: z.array(SuggestedActionSchema).max(4).optional(),
  conversationSummary: z.string().max(400).optional(),
});
export type VitaResponse = z.infer<typeof VitaResponseSchema>;

// ---------- User-side card interactions (sent back as user messages) ----------
export const CardInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("quick_reply"),
    id: z.string(),
    label: z.string(),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("measurement_response"),
    metric: z.string(),
    value: z.union([z.number(), z.boolean(), z.string()]),
    unit: z.string().optional(),
  }),
  z.object({
    kind: z.literal("action_toggle"),
    title: z.string(),
    completed: z.boolean(),
  }),
  z.object({
    kind: z.literal("memory_decision"),
    accepted: z.boolean(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("tracker_decision"),
    accepted: z.boolean(),
    title: z.string(),
    durationDays: z.number().optional(),
  }),
]);
export type CardInteraction = z.infer<typeof CardInteractionSchema>;
