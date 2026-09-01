-- PaySync Stage 1 authoritative PostgreSQL schema.
-- Monetary values are stored as integer minor units (UGX currently has 0 decimals).

create schema if not exists private;
revoke all on schema private from public;

create type public.organization_status as enum ('active', 'suspended', 'closed');
create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.app_role as enum ('cashier', 'auditor', 'admin');
create type public.payment_network as enum ('MTN', 'Airtel');
create type public.session_source as enum ('manual', 'csv', 'xlsx');
create type public.session_status as enum ('draft', 'verifying', 'ready', 'processing', 'completed', 'paused', 'cancelled');
create type public.verification_status as enum ('pending', 'verified', 'mismatch', 'unknown', 'failed', 'overridden');
create type public.batch_status as enum ('draft', 'confirmed', 'processing', 'completed', 'paused', 'cancelled');
create type public.payment_status as enum ('pending', 'claimed', 'submitting', 'submitted', 'succeeded', 'failed', 'unknown', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  account_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  reference text not null check (char_length(reference) between 4 and 80),
  request_idempotency_key text not null default gen_random_uuid()::text check (char_length(request_idempotency_key) between 8 and 200),
  name text not null check (char_length(trim(name)) between 2 and 160),
  source public.session_source not null,
  status public.session_status not null default 'draft',
  currency char(3) not null default 'UGX' check (currency ~ '^[A-Z]{3}$'),
  batch_size integer not null default 10 check (batch_size between 1 and 500),
  total_contacts integer not null default 0 check (total_contacts >= 0),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  unique (id, organization_id)
);

create unique index sessions_request_idempotency_unique
  on public.payment_sessions (organization_id, request_idempotency_key);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  session_id uuid not null,
  name_on_file text not null check (char_length(trim(name_on_file)) between 2 and 160),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  network public.payment_network not null,
  amount_minor bigint not null check (amount_minor > 0),
  registered_name text,
  verification_status public.verification_status not null default 'pending',
  verification_reference text,
  verified_at timestamptz,
  override_reason text,
  overridden_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, phone_e164),
  unique (id, organization_id),
  foreign key (session_id, organization_id) references public.payment_sessions(id, organization_id) on delete cascade,
  check ((verification_status = 'overridden') = (override_reason is not null and overridden_by is not null)),
  check (verification_status not in ('verified', 'mismatch') or registered_name is not null)
);

create table public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  session_id uuid not null,
  batch_number integer not null check (batch_number > 0),
  status public.batch_status not null default 'draft',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  contact_count integer not null check (contact_count > 0),
  total_amount_minor bigint not null check (total_amount_minor > 0),
  created_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, batch_number),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  foreign key (session_id, organization_id) references public.payment_sessions(id, organization_id) on delete cascade,
  check ((confirmed_at is null and confirmed_by is null) or (confirmed_at is not null and confirmed_by is not null))
);

create table public.batch_contacts (
  batch_id uuid not null,
  contact_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  primary key (batch_id, contact_id),
  unique (contact_id),
  foreign key (batch_id, organization_id) references public.payment_batches(id, organization_id) on delete cascade,
  foreign key (contact_id, organization_id) references public.contacts(id, organization_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  session_id uuid not null,
  batch_id uuid not null,
  contact_id uuid not null,
  network public.payment_network not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'UGX' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  provider_reference text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (contact_id),
  unique (id, organization_id),
  foreign key (session_id, organization_id) references public.payment_sessions(id, organization_id),
  foreign key (batch_id, organization_id) references public.payment_batches(id, organization_id),
  foreign key (contact_id, organization_id) references public.contacts(id, organization_id)
);

create unique index payments_provider_reference_unique
  on public.payments (network, provider_reference)
  where provider_reference is not null;

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_id uuid,
  network public.payment_network not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (network, provider_event_id),
  unique (network, payload_sha256),
  foreign key (payment_id, organization_id) references public.payments(id, organization_id)
);

create table public.audit_records (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_user_active_idx on public.organization_memberships (user_id, organization_id) where is_active;
create index sessions_org_status_created_idx on public.payment_sessions (organization_id, status, created_at desc);
create index contacts_claimable_idx on public.contacts (session_id, created_at, id) where verification_status in ('verified', 'overridden');
create index batches_session_status_idx on public.payment_batches (session_id, status, created_at);
create index payments_reconcile_idx on public.payments (organization_id, status, updated_at) where status in ('submitted', 'unknown');
create index provider_events_unprocessed_idx on public.provider_events (received_at) where processed_at is null;
create index audit_org_created_idx on public.audit_records (organization_id, created_at desc);

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','profiles','organization_memberships','payment_sessions','contacts','payment_batches','payments']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name);
  end loop;
end;
$$;

create function private.is_active_member(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.is_active
      and profile.account_status = 'active'
      and organization.status = 'active'
  );
$$;

create function private.has_role(target_organization_id uuid, allowed_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_member(target_organization_id) and exists (
    select 1 from public.organization_memberships
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
      and is_active
      and role = any(allowed_roles)
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.is_active_member(uuid) from public;
revoke all on function private.has_role(uuid, public.app_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.app_role[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.payment_sessions enable row level security;
alter table public.contacts enable row level security;
alter table public.payment_batches enable row level security;
alter table public.batch_contacts enable row level security;
alter table public.payments enable row level security;
alter table public.provider_events enable row level security;
alter table public.audit_records enable row level security;

create policy organizations_member_select on public.organizations for select to authenticated using (private.is_active_member(id));
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy memberships_member_select on public.organization_memberships for select to authenticated using (private.is_active_member(organization_id));

create policy sessions_member_select on public.payment_sessions for select to authenticated using (private.is_active_member(organization_id));
create policy sessions_cashier_insert on public.payment_sessions for insert to authenticated with check (created_by = (select auth.uid()) and private.has_role(organization_id, array['cashier','admin']::public.app_role[]));
create policy sessions_cashier_update on public.payment_sessions for update to authenticated using (private.has_role(organization_id, array['cashier','admin']::public.app_role[])) with check (private.has_role(organization_id, array['cashier','admin']::public.app_role[]));

create policy contacts_member_select on public.contacts for select to authenticated using (private.is_active_member(organization_id));
create policy contacts_cashier_insert on public.contacts for insert to authenticated with check (private.has_role(organization_id, array['cashier','admin']::public.app_role[]));
create policy contacts_cashier_update on public.contacts for update to authenticated using (private.has_role(organization_id, array['cashier','admin']::public.app_role[])) with check (private.has_role(organization_id, array['cashier','admin']::public.app_role[]));

create policy batches_member_select on public.payment_batches for select to authenticated using (private.is_active_member(organization_id));
create policy batch_contacts_member_select on public.batch_contacts for select to authenticated using (private.is_active_member(organization_id));
create policy payments_member_select on public.payments for select to authenticated using (private.is_active_member(organization_id));
create policy provider_events_auditor_select on public.provider_events for select to authenticated using (private.has_role(organization_id, array['auditor','admin']::public.app_role[]));
create policy audit_member_select on public.audit_records for select to authenticated using (private.is_active_member(organization_id));

-- Mutation of batches, payments, provider events, and audit records is intentionally
-- server-only. Authenticated browser clients receive SELECT policies only.

grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.organization_memberships,
  public.payment_sessions, public.contacts, public.payment_batches,
  public.batch_contacts, public.payments, public.provider_events,
  public.audit_records to authenticated;

create function private.claim_payment_batch_impl(
  target_session_id uuid,
  requested_size integer,
  request_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  selected_organization_id uuid;
  selected_batch_id uuid;
  selected_batch_number integer;
  selected_contact_count integer;
  selected_total bigint;
  requester_user_id uuid;
begin
  requester_user_id := auth.uid();
  if requester_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if requested_size not between 1 and 500 then raise exception 'requested_size must be between 1 and 500' using errcode = '22023'; end if;
  if char_length(request_idempotency_key) not between 8 and 200 then raise exception 'invalid idempotency key' using errcode = '22023'; end if;

  select organization_id into selected_organization_id
  from public.payment_sessions
  where id = target_session_id and status in ('ready', 'processing')
  for update;

  if selected_organization_id is null then raise exception 'eligible session not found' using errcode = 'P0002'; end if;
  if not private.has_role(selected_organization_id, array['cashier','admin']::public.app_role[]) then raise exception 'insufficient role' using errcode = '42501'; end if;

  select id into selected_batch_id from public.payment_batches
  where organization_id = selected_organization_id and idempotency_key = request_idempotency_key;
  if selected_batch_id is not null then return selected_batch_id; end if;

  select coalesce(max(batch_number), 0) + 1 into selected_batch_number
  from public.payment_batches where session_id = target_session_id;

  create temporary table if not exists pg_temp.claimed_contacts (id uuid primary key, amount_minor bigint) on commit drop;
  truncate pg_temp.claimed_contacts;
  insert into pg_temp.claimed_contacts (id, amount_minor)
  select contact.id, contact.amount_minor
  from public.contacts contact
  where contact.session_id = target_session_id
    and contact.verification_status in ('verified', 'overridden')
    and not exists (select 1 from public.batch_contacts existing where existing.contact_id = contact.id)
  order by contact.created_at, contact.id
  for update of contact skip locked
  limit requested_size;

  select count(*), coalesce(sum(amount_minor), 0) into selected_contact_count, selected_total from pg_temp.claimed_contacts;
  if selected_contact_count = 0 then raise exception 'no claimable contacts' using errcode = 'P0002'; end if;

  insert into public.payment_batches (organization_id, session_id, batch_number, idempotency_key, contact_count, total_amount_minor, created_by)
  values (selected_organization_id, target_session_id, selected_batch_number, request_idempotency_key, selected_contact_count, selected_total, requester_user_id)
  returning id into selected_batch_id;

  insert into public.batch_contacts (batch_id, contact_id, organization_id)
  select selected_batch_id, id, selected_organization_id from pg_temp.claimed_contacts;

  update public.payment_sessions set status = 'processing', version = version + 1 where id = target_session_id;
  return selected_batch_id;
end;
$$;

revoke all on function private.claim_payment_batch_impl(uuid, integer, text) from public;
grant execute on function private.claim_payment_batch_impl(uuid, integer, text) to authenticated;

create function public.claim_payment_batch(target_session_id uuid, requested_size integer, request_idempotency_key text)
returns uuid
language sql security invoker set search_path = '' as $$
  select private.claim_payment_batch_impl(target_session_id, requested_size, request_idempotency_key);
$$;

revoke all on function public.claim_payment_batch(uuid, integer, text) from public;
grant execute on function public.claim_payment_batch(uuid, integer, text) to authenticated;

create function public.create_payment_session_as_service(
  target_organization_id uuid,
  actor_user_id uuid,
  request_idempotency_key text,
  session_name text,
  session_source public.session_source,
  requested_batch_size integer,
  contact_rows jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  created_session_id uuid;
  created_reference text;
  contact_count integer;
  total_amount bigint;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if char_length(request_idempotency_key) not between 8 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  if char_length(trim(session_name)) not between 2 and 160 then
    raise exception 'invalid session name' using errcode = '22023';
  end if;
  if requested_batch_size not between 1 and 500 then
    raise exception 'batch size must be between 1 and 500' using errcode = '22023';
  end if;
  if jsonb_typeof(contact_rows) <> 'array' or jsonb_array_length(contact_rows) not between 1 and 5000 then
    raise exception 'contacts must contain between 1 and 5000 rows' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.user_id = actor_user_id
      and membership.is_active
      and membership.role in ('cashier', 'admin')
      and profile.account_status = 'active'
      and organization.status = 'active'
  ) then
    raise exception 'active cashier or administrator membership required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || ':' || request_idempotency_key, 0));

  select id into created_session_id
  from public.payment_sessions
  where organization_id = target_organization_id
    and payment_sessions.request_idempotency_key = create_payment_session_as_service.request_idempotency_key;
  if created_session_id is not null then return created_session_id; end if;

  select count(*), sum((row_data->>'amount_minor')::bigint)
    into contact_count, total_amount
  from jsonb_array_elements(contact_rows) row_data;

  created_reference := 'PS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.payment_sessions
    (organization_id, created_by, reference, request_idempotency_key, name, source, status, batch_size, total_contacts, total_amount_minor)
  values
    (target_organization_id, actor_user_id, created_reference, request_idempotency_key, trim(session_name), session_source, 'draft', requested_batch_size, contact_count, total_amount)
  returning id into created_session_id;

  insert into public.contacts
    (organization_id, session_id, name_on_file, phone_e164, network, amount_minor)
  select
    target_organization_id,
    created_session_id,
    trim(row_data->>'name'),
    row_data->>'phone_e164',
    (row_data->>'network')::public.payment_network,
    (row_data->>'amount_minor')::bigint
  from jsonb_array_elements(contact_rows) row_data;

  insert into public.audit_records
    (organization_id, actor_user_id, action, entity_type, entity_id, request_id, details)
  values
    (target_organization_id, actor_user_id, 'session.created', 'payment_session', created_session_id::text, request_idempotency_key,
      jsonb_build_object('reference', created_reference, 'accepted', contact_count, 'source', session_source));

  return created_session_id;
end;
$$;

revoke all on function public.create_payment_session_as_service(uuid, uuid, text, text, public.session_source, integer, jsonb) from public;
grant usage on schema public to service_role;
grant select, insert, update on public.organizations, public.profiles,
  public.organization_memberships, public.payment_sessions, public.contacts,
  public.audit_records to service_role;
grant usage, select on sequence public.audit_records_id_seq to service_role;
grant execute on function public.create_payment_session_as_service(uuid, uuid, text, text, public.session_source, integer, jsonb) to service_role;
