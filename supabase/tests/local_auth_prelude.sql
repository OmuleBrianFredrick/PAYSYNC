-- Minimal Supabase-compatible auth surface for isolated PostgreSQL migration tests.
-- The real Supabase environment provides these roles, schema, table, and function.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text unique
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
