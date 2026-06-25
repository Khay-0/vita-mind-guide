import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bienvenue — Vita" }] }),
  component: Onboarding,
});

const STEPS = ["Toi", "Mensurations", "Santé", "Objectifs"] as const;

function Onboarding() {
  const session = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  function toggleGoal(g: string) {
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  async function finish() {
    if (!session) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name || null,
          birthdate: birthdate || null,
          sex: sex || null,
          height_cm: height ? Number(height) : null,
          weight_kg: weight ? Number(weight) : null,
          allergies: split(allergies),
          conditions: split(conditions),
          medications: split(medications),
          goals,
          onboarded: true,
          xp: 50,
        })
        .eq("user_id", session.user.id);
      if (error) throw error;
      toast.success("+50 XP — Profil créé !");
      // Update the cached profile immediately so /home doesn't bounce us
      // back here while the refetch is in flight.
      qc.setQueryData(["profile", session.user.id], (old: any) => ({
        ...(old ?? {}),
        display_name: name || null,
        birthdate: birthdate || null,
        sex: sex || null,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        allergies: split(allergies),
        conditions: split(conditions),
        medications: split(medications),
        goals,
        onboarded: true,
        xp: (old?.xp ?? 0) + 50,
      }));
      qc.invalidateQueries({ queryKey: ["profile", session.user.id] });
      navigate({ to: "/home", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Étape {step + 1} / {STEPS.length}
        </div>
        <h1 className="text-2xl font-extrabold">{STEPS[step]}</h1>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <Field label="Comment t'appeler ?">
            <input
              className="input-chunky"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton prénom"
            />
          </Field>
          <Field label="Date de naissance">
            <input
              type="date"
              className="input-chunky"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </Field>
          <Field label="Sexe biologique (utile pour les recommandations)">
            <div className="grid grid-cols-3 gap-2">
              {(["male", "female", "other"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`rounded-2xl border-2 py-3 font-extrabold capitalize ${
                    sex === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card"
                  }`}
                >
                  {s === "male" ? "Homme" : s === "female" ? "Femme" : "Autre"}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Field label="Taille (cm)">
            <input
              type="number"
              className="input-chunky"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
              inputMode="numeric"
            />
          </Field>
          <Field label="Poids (kg)">
            <input
              type="number"
              className="input-chunky"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="70"
              inputMode="decimal"
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Field label="Allergies (séparées par des virgules)">
            <input
              className="input-chunky"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="ex: pollen, arachides"
            />
          </Field>
          <Field label="Conditions médicales">
            <input
              className="input-chunky"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="ex: asthme, hypertension"
            />
          </Field>
          <Field label="Médicaments en cours">
            <input
              className="input-chunky"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="ex: ventoline"
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Sélectionne tes objectifs (plusieurs possibles)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Perdre du poids",
              "Prendre du muscle",
              "Mieux dormir",
              "Plus d'énergie",
              "Réduire le stress",
              "Bouger plus",
              "Mieux manger",
              "Suivre mes symptômes",
            ].map((g) => (
              <button
                key={g}
                onClick={() => toggleGoal(g)}
                className={`rounded-2xl border-2 p-3 text-left text-sm font-bold ${
                  goals.includes(g)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="btn-chunky btn-chunky-secondary flex-1"
          >
            Retour
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="btn-chunky flex-1">
            Continuer
          </button>
        ) : (
          <button onClick={finish} disabled={saving} className="btn-chunky flex-1">
            {saving ? "…" : "Terminer"}
          </button>
        )}
      </div>
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function split(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
