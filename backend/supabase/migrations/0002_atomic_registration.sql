-- Atomic account registration: all three records commit or roll back together.
create or replace function register_startup_user(
  p_name text,
  p_email text,
  p_password_hash text,
  p_trial_ends_at timestamptz
) returns setof users
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_startup_id uuid;
  v_user users%rowtype;
begin
  insert into startups default values returning id into v_startup_id;

  insert into users (startup_id, name, email, password_hash, role)
  values (v_startup_id, p_name, lower(trim(p_email)), p_password_hash, 'owner')
  returning * into v_user;

  insert into subscriptions (startup_id, plan_code, status, ends_at)
  values (v_startup_id, 'trial', 'trialing', p_trial_ends_at);

  return next v_user;
  return;
end;
$$;

revoke all on function register_startup_user(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function register_startup_user(text, text, text, timestamptz) to service_role;
