import type { ReactNode } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useState } from "react";

/* ============ PremiumCard ============ */
export function PremiumCard({
  children,
  className = "",
  as: As = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: any;
  [k: string]: any;
}) {
  return (
    <As className={`card-premium p-5 ${className}`} {...rest}>
      {children}
    </As>
  );
}

/* ============ SectionHeader ============ */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h2 className="truncate text-[17px] font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* ============ StatTile ============ */
export function StatTile({
  icon,
  label,
  value,
  trend,
  accent = "text-primary",
}: {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  accent?: string;
}) {
  return (
    <div className="card-premium p-4">
      <div className={`flex items-center gap-1.5 text-[11px] font-medium ${accent}`}>
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight">
        {value}
      </div>
      {trend && (
        <div className="mt-1 text-[11px] text-muted-foreground">{trend}</div>
      )}
    </div>
  );
}

/* ============ RingProgress ============ */
export function RingProgress({
  value,
  size = 120,
  stroke = 10,
  color = "var(--color-primary)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-progress-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 700ms var(--ease-ios)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/* ============ Sparkline ============ */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--color-primary)",
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="rounded bg-muted/40" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill="url(#spark-grad)" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============ AreaChart (richer) ============ */
export function AreaChart({
  data,
  labels,
  height = 140,
  color = "var(--color-primary)",
}: {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const width = 320;
  if (data.length < 2) {
    return <div style={{ height }} className="grid place-items-center rounded-xl bg-muted/40 text-xs text-muted-foreground">Pas encore de données</div>;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((d, i) => [i * stepX, height - 28 - ((d - min) / span) * (height - 48)] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height - 20} L0,${height - 20} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#area-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {labels && labels.map((l, i) => (
        <text key={i} x={i * stepX} y={height - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
          {l}
        </text>
      ))}
    </svg>
  );
}

/* ============ StepDots ============ */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-foreground" : i < current ? "w-1.5 bg-foreground/60" : "w-1.5 bg-border"}`}
        />
      ))}
    </div>
  );
}

/* ============ ChoiceCard ============ */
export function ChoiceCard({
  selected,
  onClick,
  icon,
  label,
  description,
  multi = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  description?: string;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.985] ${
        selected
          ? "border-primary bg-primary/5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]"
          : "border-border bg-surface-1 hover:border-foreground/20"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${selected ? "bg-primary/15 text-primary" : "bg-muted text-foreground/80"}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">{label}</div>
          {description && (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</div>
          )}
        </div>
        <div
          className={`grid shrink-0 place-items-center rounded-full transition-all ${
            multi ? "h-5 w-5 rounded-md" : "h-5 w-5"
          } ${selected ? "bg-primary text-primary-foreground scale-100" : "scale-90 bg-transparent text-transparent ring-1 ring-border"}`}
        >
          <Check size={12} strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}

/* ============ WizardShell ============ */
export type WizardStep = {
  key: string;
  question: string;
  helper?: string;
  render: (ctx: { value: any; setValue: (v: any) => void; goNext: () => void }) => ReactNode;
  validate?: (value: any) => boolean;
};

export function WizardShell({
  steps,
  values,
  setValues,
  onCancel,
  onFinish,
  finishLabel = "Terminer",
  submitting = false,
  accent = "var(--color-primary)",
}: {
  steps: WizardStep[];
  values: Record<string, any>;
  setValues: (v: Record<string, any>) => void;
  onCancel: () => void;
  onFinish: () => void;
  finishLabel?: string;
  submitting?: boolean;
  accent?: string;
}) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const value = values[step.key];
  const isValid = step.validate ? step.validate(value) : value != null && value !== "" && !(Array.isArray(value) && value.length === 0);
  const last = i === steps.length - 1;

  const setValue = (v: any) => setValues({ ...values, [step.key]: v });
  const goNext = () => {
    if (last) return onFinish();
    setI(i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="safe-top flex items-center justify-between px-4 pb-3 pt-4">
        <button
          onClick={i === 0 ? onCancel : () => setI(i - 1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground/70 transition active:scale-95"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>
        <StepDots total={steps.length} current={i} />
        <div className="w-9" />
      </header>

      <main key={step.key} className="flex-1 overflow-y-auto px-5 pb-8 stagger-fade">
        <div className="mt-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Étape {i + 1} sur {steps.length}
          </div>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
            {step.question}
          </h1>
          {step.helper && (
            <p className="mt-2 text-[14px] text-muted-foreground">{step.helper}</p>
          )}
        </div>
        <div className="mt-6">{step.render({ value, setValue, goNext })}</div>
      </main>

      <footer className="safe-bottom border-t border-border/60 bg-surface-1/90 px-5 pt-3 backdrop-blur">
        <button
          onClick={goNext}
          disabled={!isValid || submitting}
          className="btn-ios w-full disabled:opacity-40"
          style={{ background: accent }}
        >
          {submitting ? "Préparation…" : last ? finishLabel : "Continuer"}
        </button>
      </footer>
    </div>
  );
}

/* ============ Segmented control ============ */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 font-semibold transition ${value === o.value ? "bg-surface-1 text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============ Stepper (number) ============ */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center justify-center gap-4 rounded-2xl bg-muted/60 p-4">
      <button onClick={() => onChange(clamp(value - step))} className="grid h-12 w-12 place-items-center rounded-full bg-surface-1 text-2xl font-bold shadow-sm active:scale-95">−</button>
      <div className="min-w-[120px] text-center">
        <div className="text-4xl font-bold tabular-nums tracking-tight">{value}</div>
        {unit && <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{unit}</div>}
      </div>
      <button onClick={() => onChange(clamp(value + step))} className="grid h-12 w-12 place-items-center rounded-full bg-surface-1 text-2xl font-bold shadow-sm active:scale-95">+</button>
    </div>
  );
}
