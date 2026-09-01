\set ON_ERROR_STOP on

insert into auth.users (id, email)
values ('30000000-0000-0000-0000-000000000003', 'concurrency@example.test');

insert into public.profiles (id, display_name, account_status)
values ('30000000-0000-0000-0000-000000000003', 'Concurrency Cashier', 'active');

insert into public.organizations (id, name, slug)
values ('a0000000-0000-0000-0000-000000000003', 'Concurrency Organization', 'concurrency-org');

insert into public.organization_memberships (organization_id, user_id, role)
values ('a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'cashier');

insert into public.payment_sessions
  (id, organization_id, created_by, reference, name, source, status, batch_size, total_contacts, total_amount_minor)
values
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'RUN-CONCURRENT', 'Concurrent run', 'csv', 'ready', 5, 10, 55000);

insert into public.contacts
  (organization_id, session_id, name_on_file, phone_e164, network, amount_minor, registered_name, verification_status, verified_at)
select
  'a0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000003',
  'Recipient ' || item,
  '+256771000' || lpad((100 + item)::text, 3, '0'),
  'MTN',
  item * 1000,
  'Recipient ' || item,
  'verified',
  now()
from generate_series(1, 10) item;
