-- AI question-set generator (dev-tier first)
-- Staging for generated sets + sitewide daily usage cap + per-call usage log.

-- ── Staging columns on existing sets ──
-- `staged` rows are saved immediately by the generator but hidden from the library,
-- play pickers, and the quota count until the user explicitly adds them.
alter table public.user_question_sets
  add column if not exists staged boolean not null default false;
alter table public.user_question_sets
  add column if not exists ai_note text;

-- ── Remembered Create-form settings (auto-synced per user; no presets/buttons) ──
alter table public.profiles
  add column if not exists create_prefs jsonb;

-- ── Per-user monthly AI credit allotment (optional override; null = tier default) ──
-- Tier defaults live in src/lib/ai/access.js (regular 1, pro 30, dev/admin unlimited).
alter table public.profiles
  add column if not exists ai_monthly_credits integer;

-- ── Usage counters ──
-- Sitewide daily counter (platform overbilling backstop).
create table if not exists public.ai_usage_daily (
  day date primary key,
  count integer not null default 0
);
alter table public.ai_usage_daily enable row level security;

-- Per-user monthly credit usage.
create table if not exists public.ai_usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  credits integer not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage_monthly enable row level security;
-- No policies on either: only the service-role key (server) touches them.

-- Atomically check + consume p_amount credits against BOTH the per-user monthly
-- allotment and the sitewide daily cap. Returns jsonb:
--   { ok, reason, daily_used, monthly_used }   (reason: 'monthly' | 'daily' when ok=false)
-- Runs in one transaction with FOR UPDATE locks, so concurrent requests can't
-- both slip under a cap.
drop function if exists public.increment_ai_usage(integer);
drop function if exists public.increment_ai_usage(integer, integer);
create or replace function public.consume_ai_credits(
  p_user uuid, p_amount integer, p_daily_cap integer, p_monthly_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := current_date;
  v_month date := date_trunc('month', current_date)::date;
  v_daily integer;
  v_monthly integer;
begin
  insert into public.ai_usage_daily (day, count) values (v_day, 0) on conflict (day) do nothing;
  insert into public.ai_usage_monthly (user_id, month, credits) values (p_user, v_month, 0) on conflict (user_id, month) do nothing;

  select count into v_daily from public.ai_usage_daily where day = v_day for update;
  select credits into v_monthly from public.ai_usage_monthly where user_id = p_user and month = v_month for update;

  if v_monthly + p_amount > p_monthly_cap then
    return jsonb_build_object('ok', false, 'reason', 'monthly', 'daily_used', v_daily, 'monthly_used', v_monthly);
  end if;
  if v_daily + p_amount > p_daily_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily', 'daily_used', v_daily, 'monthly_used', v_monthly);
  end if;

  update public.ai_usage_daily set count = count + p_amount where day = v_day;
  update public.ai_usage_monthly set credits = credits + p_amount where user_id = p_user and month = v_month;

  return jsonb_build_object('ok', true, 'daily_used', v_daily + p_amount, 'monthly_used', v_monthly + p_amount);
end;
$$;

revoke all on function public.consume_ai_credits(uuid, integer, integer, integer) from public;
grant execute on function public.consume_ai_credits(uuid, integer, integer, integer) to service_role;
grant all privileges on table public.ai_usage_monthly to service_role;

-- ── Per-call usage log (visibility into spend/usage) ──
create table if not exists public.ai_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  mode          text,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  est_cost      numeric(10,4),
  set_id        uuid
);
alter table public.ai_generations enable row level security;
-- No policies: written only by the service-role key (server).

-- ── Service-role grants ──
-- This project does not grant the service_role broad table access by default,
-- so the server (which uses the service-role key) must be granted explicitly.
-- service_role bypasses RLS, so these grants give the server full server-side access.
grant all privileges on table
  public.profiles,
  public.user_question_sets,
  public.ai_usage_daily,
  public.ai_generations
to service_role;
