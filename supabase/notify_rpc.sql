-- NovaWallet — deposit / withdrawal / swap email notifications
-- Run this once in Supabase Dashboard -> SQL Editor (after schema.sql and otp_rpc.sql).
-- Reuses the same vault secret (`nova_github_token`) and GitHub Actions mail
-- secrets (MAIL_USER / MAIL_PASS) as the login OTP workflow.

create table if not exists public.wallet_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdrawal', 'swap')),
  title text not null,
  body text not null,
  dedupe text,
  created_at timestamptz not null default now()
);

alter table public.wallet_notifications enable row level security;
revoke all on public.wallet_notifications from public, anon, authenticated;

create unique index if not exists wallet_notifications_dedupe_idx
  on public.wallet_notifications (user_id, dedupe)
  where dedupe is not null;

create index if not exists wallet_notifications_user_time_idx
  on public.wallet_notifications (user_id, created_at desc);

create or replace function public.request_wallet_notification(
  p_kind text,
  p_title text,
  p_body text,
  p_dedupe text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_gh text;
  v_res extensions.http_response;
  v_id bigint;
  v_recent int;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_dedupe text := nullif(btrim(coalesce(p_dedupe, '')), '');
begin
  set local statement_timeout = '20s';

  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_kind not in ('deposit', 'withdrawal', 'swap') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;

  if length(v_title) = 0 or length(v_title) > 160
     or length(v_body) = 0 or length(v_body) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;

  if v_dedupe is not null and length(v_dedupe) > 200 then
    v_dedupe := substr(v_dedupe, 1, 200);
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null or length(v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_email');
  end if;

  select count(*) into v_recent
    from public.wallet_notifications
    where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limit');
  end if;

  -- Reserve the dedupe slot before dispatching so parallel tabs cannot double-send.
  if v_dedupe is not null then
    insert into public.wallet_notifications (user_id, kind, title, body, dedupe)
    values (v_uid, v_kind, v_title, v_body, v_dedupe)
    on conflict (user_id, dedupe) where dedupe is not null do nothing
    returning id into v_id;

    if v_id is null then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
  else
    insert into public.wallet_notifications (user_id, kind, title, body)
    values (v_uid, v_kind, v_title, v_body)
    returning id into v_id;
  end if;

  select decrypted_secret into v_gh
    from vault.decrypted_secrets where name = 'nova_github_token' limit 1;

  if v_gh is null then
    delete from public.wallet_notifications where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'not_configured');
  end if;

  begin
    v_res := extensions.http((
      'POST'::extensions.http_method,
      'https://api.github.com/repos/shoaibali1122aass-stack/novawallet/dispatches',
      array[
        ('Authorization', 'Bearer ' || v_gh)::extensions.http_header,
        ('Accept', 'application/vnd.github+json')::extensions.http_header,
        ('User-Agent', 'NovaWallet-Notify')::extensions.http_header
      ],
      'application/json',
      jsonb_build_object(
        'event_type', 'send-notification',
        'client_payload', jsonb_build_object(
          'email', v_email,
          'kind', v_kind,
          'title', v_title,
          'body', v_body
        )
      )::text
    )::extensions.http_request);
  exception when others then
    delete from public.wallet_notifications where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'network');
  end;

  if v_res.status is null or v_res.status not in (200, 204) then
    delete from public.wallet_notifications where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'dispatch_failed');
  end if;

  delete from public.wallet_notifications where created_at < now() - interval '7 days';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_wallet_notification(text, text, text, text) from public;
grant execute on function public.request_wallet_notification(text, text, text, text) to authenticated;
