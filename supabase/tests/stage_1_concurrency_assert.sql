\set ON_ERROR_STOP on

do $$
declare
  batch_count integer;
  assignment_count integer;
  distinct_contact_count integer;
  assigned_total bigint;
  idempotent_sessions integer;
  idempotent_contacts integer;
begin
  select count(*) into batch_count
  from public.payment_batches
  where session_id = 'c0000000-0000-0000-0000-000000000003';

  select count(*), count(distinct batch_contact.contact_id), sum(contact.amount_minor)
    into assignment_count, distinct_contact_count, assigned_total
  from public.batch_contacts batch_contact
  join public.contacts contact on contact.id = batch_contact.contact_id
  where contact.session_id = 'c0000000-0000-0000-0000-000000000003';

  if batch_count <> 2 then
    raise exception 'expected two concurrent batches, found %', batch_count;
  end if;
  if assignment_count <> 10 or distinct_contact_count <> 10 then
    raise exception 'contact assignment failure: assignments %, distinct %', assignment_count, distinct_contact_count;
  end if;
  if assigned_total <> 55000 then
    raise exception 'amount preservation failure: expected 55000, found %', assigned_total;
  end if;

  select count(*) into idempotent_sessions
  from public.payment_sessions
  where organization_id = 'a0000000-0000-0000-0000-000000000003'
    and request_idempotency_key = 'concurrent-create-0001';
  select count(*) into idempotent_contacts
  from public.contacts contact
  join public.payment_sessions session on session.id = contact.session_id
  where session.organization_id = 'a0000000-0000-0000-0000-000000000003'
    and session.request_idempotency_key = 'concurrent-create-0001';
  if idempotent_sessions <> 1 or idempotent_contacts <> 1 then
    raise exception 'concurrent idempotency failure: sessions %, contacts %', idempotent_sessions, idempotent_contacts;
  end if;
end;
$$;

\echo 'Stage 1 simultaneous batch-claim test passed.'
