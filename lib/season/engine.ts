import { q, qOne } from '@/lib/db';
import { pushToAll } from '@/lib/push/send';

const seasonDuration = () => {
  const d = Number(process.env.TEST_SEASON_DURATION || 0);
  return d > 0 ? d : null;
};

/** Последний сезон (любой статус) или null. */
export async function getLatestSeason() {
  return qOne(`select * from seasons order by number desc limit 1`);
}

/** Активный сезон или null. */
export async function getActiveSeason() {
  return qOne(`select * from seasons where status = 'active' order by number desc limit 1`);
}

/** Рождение мира: создать сезон #1, если сезонов ещё нет вовсе. */
export async function ensureWorldBirth() {
  const latest = await getLatestSeason();
  if (latest) return latest;
  return qOne(`select * from ensure_active_season($1)`, [seasonDuration()]);
}

export async function runDailyReset() {
  const row = await qOne<{ daily_reset: Record<string, unknown> }>(`select daily_reset() as daily_reset`);
  const res = row?.daily_reset ?? null;
  if (res) {
    // награда за выживание: по 1 монете за каждое выжившее сообщение автору
    const survivors = await q<{ author_id: string; survived: number }>(
      `select author_id, count(*)::int as survived
       from messages where last_survived_at = now()
       group by author_id`
    );
    for (const s of survivors) {
      await q(`update wallets set balance = balance + $1 where user_id = $2`, [s.survived, s.author_id]);
      await q(
        `insert into wallet_transactions (user_id, amount, kind, description)
         values ($1, $2, 'reward', 'Выжило сообщений: ' || $3)`,
        [s.author_id, s.survived, s.survived]
      );
    }
    if (survivors.length > 0) {
      console.log(`Награждено ${survivors.length} авторов за ${survivors.reduce((s, x) => s + x.survived, 0)} выживших сообщений`);
    }
    void pushToAll({
      title: '🟢 RESET',
      body: `${res.survived} выжили · ${res.died} погибли`,
      url: '/',
    });
  }
  return res;
}

export async function runSeasonDeath() {
  const row = await qOne<{ season_death: Record<string, unknown> }>(`select season_death() as season_death`);
  const res = row?.season_death ?? null;
  if (res) {
    void pushToAll({
      title: `💀 СЕЗОН #${res.ended_season} ЗАВЕРШЁН`,
      body: `Погибло ${res.messages_died_total} · Выжило ${res.messages_survived_final}`,
      url: '/',
    });
  }
  return res;
}

export async function startNextSeason() {
  return qOne(`select * from next_season($1)`, [seasonDuration()]);
}

export async function refreshAttention() {
  await q(`select * from refresh_attention_statuses()`);
}
