'use client';

/**
 * Шанс выжить в следующей волне — честная метка на посте.
 * Формула движка: 0.3 + черепки×0.04 + ответы×0.04, clamp [0.05, 0.95].
 * Никаких «умрёт завтра» — волна случайна, мы показываем вероятность.
 *
 * Статусы:
 *  - легенда (⭐ 5+ выживаний) — золото, без шанса (факт, не вероятность)
 *  - выживший (пережил 1+ волн) — тёплый бордер + «пережил N волн · шанс X%»
 *  - обычный — «шанс X%»
 */
export function survivalChance(item: { reaction_count?: number | null; reply_count?: number | null }): number {
  const skulls = item.reaction_count ?? 0;
  const replies = item.reply_count ?? 0;
  const raw = 0.3 + skulls * 0.04 + replies * 0.04;
  return Math.min(Math.max(raw, 0.05), 0.95);
}

export function SurvivalChance({ item, legendary }: {
  item: { reaction_count?: number | null; reply_count?: number | null; survival_count?: number | null; status?: string | null };
  legendary?: boolean;
}) {
  // легенда — уже факт выживания, показываем ⭐ вместо вероятности
  const isLegend = legendary || item.status === 'legendary' || (item.survival_count ?? 0) >= 5;
  if (isLegend) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-rip-gold tracking-wide">
        ⭐ легенда · {(item.survival_count ?? 0)} выживаний
      </span>
    );
  }

  const surv = item.survival_count ?? 0;
  const pct = Math.round(survivalChance(item) * 100);
  const survived = surv > 0;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-px text-[10px] tracking-wide border ${
        survived
          ? 'border-rip-rust/40 text-rip-rust'          // выживший — тёплый
          : 'border-rip-line text-rip-dim/80'            // обычный — приглушённый
      }`}
      title="Шанс пережить следующую волну: 30% + черепки×4% + ответы×4%"
    >
      {survived && <span className="mr-1">пережил {surv} {surv === 1 ? 'волну' : surv < 5 ? 'волны' : 'волн'} ·</span>}
      шанс {pct}%
    </span>
  );
}
