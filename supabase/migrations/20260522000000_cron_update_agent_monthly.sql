-- ============================================================
-- Cron schedule: trigger update-agent Edge Function monthly
-- ============================================================
--
-- כדי שהסוכן החכם (`supabase/functions/update-agent`) יתעדכן לבד מהממשלה,
-- אנחנו מתזמנים אותו ב-pg_cron לרוץ פעם בחודש (ב-1 לחודש, 03:00 UTC).
--
-- שלוש הרחבות שאנו צריכים:
--   pg_cron        — תזמון משימות בסגנון crontab בתוך Postgres.
--   pg_net         — שליחת בקשות HTTP אסינכרוניות מתוך SQL.
--   supabase_vault — שמירה מוצפנת של ה-URL וה-service_role key (לא בקוד).
--
-- שדה ה-`trigger` ב-update_log יקבל את הערך 'scheduled' אוטומטית, כי
-- ה-Edge Function בודקת את ה-header `x-trigger: cron` שאנחנו שולחים כאן.
--
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ─── Unschedule prior version (idempotent re-run) ────────────────────────────
do $$
begin
  perform cron.unschedule('update-agent-monthly');
exception when others then
  null;
end $$;

-- ─── Schedule monthly trigger ────────────────────────────────────────────────
-- '0 3 1 * *' = ב-1 לכל חודש בשעה 03:00 UTC (06:00 שעון ישראל בקיץ).
-- שעת לילה נבחרה במכוון כדי לא להתנגש עם משתמשים פעילים, ו-1 לחודש
-- כדי שמערכי הנתונים החודשיים של data.gov.il (vehicle_counts, accid_taz)
-- יהיו כבר עם הגרסה המעודכנת של החודש החולף.

select cron.schedule(
  'update-agent-monthly',
  '0 3 1 * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/update-agent',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'service_role_key'
        ),
        'x-trigger', 'cron'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

comment on extension pg_cron is
  'Used by 20260522000000_cron_update_agent_monthly to run the update-agent Edge Function on the 1st of every month.';

-- ─── הגדרה חד-פעמית אצל המנהל ────────────────────────────────────────────────
-- לפני שהמשימה תרוץ בפועל יש להריץ פעם אחת (דרך SQL Editor של Supabase)
-- את שתי שורות ה-vault הבאות, עם הערכים האמיתיים של הפרויקט:
--
--   insert into vault.secrets (name, secret)
--   values ('project_url', 'https://<PROJECT_REF>.supabase.co')
--   on conflict (name) do update set secret = excluded.secret;
--
--   insert into vault.secrets (name, secret)
--   values ('service_role_key', '<SUPABASE_SERVICE_ROLE_KEY>')
--   on conflict (name) do update set secret = excluded.secret;
--
-- אחרי שיהיו ב-vault — ה-cron יתחיל לעבוד אוטומטית בריצה החודשית הבאה.
-- ============================================================
