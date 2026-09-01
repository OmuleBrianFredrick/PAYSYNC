\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'cashier-one@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'cashier-two@example.test');

insert into public.profiles (id, display_name, account_status) values
  ('10000000-0000-0000-0000-000000000001', 'Cashier One', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Cashier Two', 'active');

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'Test Organization One', 'test-org-one'),
  ('b0000000-0000-0000-0000-000000000002', 'Test Organization Two', 'test-org-two');

insert into public.organization_memberships (organization_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cashier'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'cashier');

insert into public.payment_sessions
  (id, organization_id, created_by, reference, name, source, status, batch_size, total_contacts, total_amount_minor)
values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'RUN-ONE', 'First run', 'csv', 'ready', 2, 3, 6000),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'RUN-TWO', 'Second run', 'manual', 'ready', 1, 1, 5000);

insert into public.contacts
  (id, organization_id, session_id, name_on_file, phone_e164, network, amount_minor, registered_name, verification_status, verified_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Alice One', '+256771000001', 'MTN', 1000, 'Alice One', 'verified', now()),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Alice Two', '+256771000002', 'MTN', 2000, 'Alice Two', 'verified', now()),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Alice Three', '+256751000003', 'Airtel', 3000, 'Alice Three', 'verified', now()),
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Bob One', '+256751000004', 'Airtel', 5000, 'Bob One', 'verified', now());

do $$
begin
  begin
    insert into public.contacts
      (organization_id, session_id, name_on_file, phone_e164, network, amount_minor)
    values
      ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Invalid Money', '+256771000099', 'MTN', 0);
    raise exception 'zero-value money constraint did not reject the row';
  exception when check_violation then null;
  end;
end;
$$;

set local role service_role;
do $$
declare
  created_session uuid;
  replayed_session uuid;
  created_contacts integer;
begin
  created_session := public.create_payment_session_as_service(
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'session-create-0001',
    'Atomic service run',
    'manual',
    10,
    '[{"name":"Service Recipient","phone_e164":"+256771999001","network":"MTN","amount_minor":7000}]'::jsonb
  );
  replayed_session := public.create_payment_session_as_service(
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'session-create-0001',
    'Atomic service run',
    'manual',
    10,
    '[{"name":"Service Recipient","phone_e164":"+256771999001","network":"MTN","amount_minor":7000}]'::jsonb
  );

  if created_session <> replayed_session then
    raise exception 'atomic session creation is not idempotent';
  end if;
  select count(*) into created_contacts from public.contacts where session_id = created_session;
  if created_contacts <> 1 then
    raise exception 'atomic session creation expected one contact, found %', created_contacts;
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

do $$
declare visible_organizations integer;
begin
  select count(*) into visible_organizations from public.organizations;
  if visible_organizations <> 1 then
    raise exception 'RLS failure: expected one organization, found %', visible_organizations;
  end if;

  if has_table_privilege('authenticated', 'public.payment_batches', 'INSERT') then
    raise exception 'browser role unexpectedly has direct batch INSERT privilege';
  end if;
  if has_table_privilege('authenticated', 'public.contacts', 'UPDATE') then
    raise exception 'browser role unexpectedly has direct recipient UPDATE privilege';
  end if;
end;
$$;

do $$
declare
  first_batch uuid;
  replayed_batch uuid;
  second_batch uuid;
  claimed_count integer;
  total_claimed integer;
begin
  first_batch := public.claim_payment_batch(
    'c0000000-0000-0000-0000-000000000001', 2, 'claim-request-0001'
  );
  replayed_batch := public.claim_payment_batch(
    'c0000000-0000-0000-0000-000000000001', 2, 'claim-request-0001'
  );

  if first_batch <> replayed_batch then
    raise exception 'idempotent replay returned a different batch';
  end if;

  select count(*) into claimed_count
  from public.batch_contacts
  where batch_id = first_batch;

  if claimed_count <> 2 then
    raise exception 'expected two contacts in the first batch, found %', claimed_count;
  end if;

  second_batch := public.claim_payment_batch(
    'c0000000-0000-0000-0000-000000000001', 2, 'claim-request-0002'
  );

  select count(*) into total_claimed
  from public.batch_contacts
  where organization_id = 'a0000000-0000-0000-0000-000000000001';

  if total_claimed <> 3 then
    raise exception 'expected all three contacts to be claimed exactly once, found %', total_claimed;
  end if;

  begin
    perform public.claim_payment_batch(
      'd0000000-0000-0000-0000-000000000002', 1, 'cross-tenant-0001'
    );
    raise exception 'cross-organization claim unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;

\echo 'Stage 1 core schema behavioral tests passed.'
