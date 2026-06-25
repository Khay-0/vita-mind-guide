import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { bmi } from "@/lib/score";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mon profil — Vita" }] }),
  component: Profile,
});

function Profile() {
  const session = useSession();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (profile && !form) {
      setForm({
        display_name: profile.display_name ?? "",
        birthdate: profile.birthdate ?? "",
        sex: profile.sex ?? "",
        height_cm: profile.height_cm ?? "",
        weight_kg: profile.weight_kg ?? "",
        allergies: (profile.allergies ?? []).join(", "),
        conditions: (profile.conditions ?? []).join(", "),
        medications: (profile.medications ?? []).join(", "),
      });
    }
  }, [profile, form]);

  if (!profile || !form) return null;

  async function save() {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        birthdate: form.birthdate || null,
        sex: form.sex || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        allergies: split(form.allergies),
        conditions: split(form.conditions),
        medications: split(form.medications),
      })
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    refetch();
  }

  const bmiVal = bmi(Number(form.height_cm) || null, Number(form.weight_kg) || null);

  return (
    <Page title="Mon profil" subtitle={session?.user.email ?? ""}>
      <div className="card-chunky mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Niveau" value={profile.level ?? 1} />
        <Stat label="XP" value={profile.xp ?? 0} />
        <Stat label="Série" value={`${profile.streak_days ?? 0}🔥`} />
      </div>

      {bmiVal && (
        <div className="card-chunky mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            IMC
          </div>
          <div className="text-3xl font-extrabold tabular-nums">
            {bmiVal.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            {bmiVal < 18.5
              ? "Insuffisance pondérale"
              : bmiVal < 25
                ? "Corpulence normale"
                : bmiVal < 30
                  ? "Surpoids"
                  : "Obésité"}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <F label="Prénom">
          <input
            className="input-chunky"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </F>
        <F label="Date de naissance">
          <input
            type="date"
            className="input-chunky"
            value={form.birthdate}
            onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
          />
        </F>
        <F label="Sexe">
          <select
            className="input-chunky"
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value })}
          >
            <option value="">—</option>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
            <option value="other">Autre</option>
          </select>
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Taille (cm)">
            <input
              type="number"
              inputMode="numeric"
              className="input-chunky"
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
            />
          </F>
          <F label="Poids (kg)">
            <input
              type="number"
              inputMode="decimal"
              className="input-chunky"
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            />
          </F>
        </div>
        <F label="Allergies">
          <input
            className="input-chunky"
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          />
        </F>
        <F label="Conditions médicales">
          <input
            className="input-chunky"
            value={form.conditions}
            onChange={(e) => setForm({ ...form, conditions: e.target.value })}
          />
        </F>
        <F label="Médicaments">
          <input
            className="input-chunky"
            value={form.medications}
            onChange={(e) => setForm({ ...form, medications: e.target.value })}
          />
        </F>
      </div>

      <button onClick={save} className="btn-chunky mt-6 w-full">
        Sauvegarder
      </button>

      <button
        onClick={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
        className="btn-chunky btn-chunky-secondary mt-3 w-full"
      >
        <LogOut size={18} /> Se déconnecter
      </button>
    </Page>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
function split(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
