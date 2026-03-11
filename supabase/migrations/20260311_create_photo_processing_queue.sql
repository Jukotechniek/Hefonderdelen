create table if not exists public.photo_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  article_number text not null,
  product_id text not null,
  product_name text not null,
  description text null,
  original_filename text not null,
  mime_type text null,
  original_storage_path text null,
  processed_storage_path text null,
  sequence_number integer not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  attempt_count integer not null default 0,
  error_message text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now()
);

create unique index if not exists photo_processing_jobs_product_sequence_idx
  on public.photo_processing_jobs (product_id, sequence_number);

create index if not exists photo_processing_jobs_status_created_idx
  on public.photo_processing_jobs (status, created_at);

create index if not exists photo_processing_jobs_batch_idx
  on public.photo_processing_jobs (batch_id);

create or replace function public.set_photo_processing_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_photo_processing_jobs_updated_at on public.photo_processing_jobs;
create trigger set_photo_processing_jobs_updated_at
before update on public.photo_processing_jobs
for each row
execute function public.set_photo_processing_jobs_updated_at();

create or replace function public.reserve_photo_processing_jobs(
  p_batch_id uuid,
  p_product_id text,
  p_article_number text,
  p_product_name text,
  p_description text,
  p_files jsonb
)
returns table (
  id uuid,
  sequence_number integer,
  original_filename text,
  mime_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('photo-processing-product:' || coalesce(p_product_id, ''), 0));

  select coalesce(max(j.sequence_number), 0)
    into v_base_sequence
  from public.photo_processing_jobs j
  where j.product_id = p_product_id;

  return query
  with queued_files as (
    select
      value as file_data,
      ordinality
    from jsonb_array_elements(p_files) with ordinality
  ), inserted as (
    insert into public.photo_processing_jobs (
      batch_id,
      article_number,
      product_id,
      product_name,
      description,
      original_filename,
      mime_type,
      sequence_number,
      status
    )
    select
      p_batch_id,
      p_article_number,
      p_product_id,
      p_product_name,
      p_description,
      coalesce(file_data ->> 'original_filename', 'image-' || ordinality::text),
      file_data ->> 'mime_type',
      v_base_sequence + ordinality::integer,
      'pending'
    from queued_files
    returning photo_processing_jobs.id,
      photo_processing_jobs.sequence_number,
      photo_processing_jobs.original_filename,
      photo_processing_jobs.mime_type
  )
  select inserted.id, inserted.sequence_number, inserted.original_filename, inserted.mime_type
  from inserted
  order by inserted.sequence_number;
end;
$$;

create or replace function public.claim_next_photo_processing_job()
returns setof public.photo_processing_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('photo-processing-global-claim', 0));

  update public.photo_processing_jobs
  set
    status = 'pending',
    started_at = null,
    finished_at = null,
    error_message = coalesce(error_message || E'\n', '') || 'Automatisch opnieuw in wachtrij gezet na verlopen verwerking.',
    updated_at = now()
  where status = 'processing'
    and started_at is not null
    and started_at < now() - interval '30 minutes';

  if exists (
    select 1
    from public.photo_processing_jobs
    where status = 'processing'
  ) then
    return;
  end if;

  return query
  with next_job as (
    select j.id
    from public.photo_processing_jobs j
    where j.status = 'pending'
      and j.original_storage_path is not null
    order by j.created_at asc, j.sequence_number asc
    for update skip locked
    limit 1
  ), updated as (
    update public.photo_processing_jobs j
    set
      status = 'processing',
      started_at = now(),
      finished_at = null,
      error_message = null,
      attempt_count = j.attempt_count + 1,
      updated_at = now()
    where j.id = (select id from next_job)
    returning j.*
  )
  select * from updated;
end;
$$;

alter table public.photo_processing_jobs enable row level security;

revoke all on public.photo_processing_jobs from anon, authenticated;
grant select, insert, update, delete on public.photo_processing_jobs to service_role;
grant execute on function public.reserve_photo_processing_jobs(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.claim_next_photo_processing_job() to service_role;

grant select, insert, update on public.photo_processing_jobs to authenticated;
grant execute on function public.reserve_photo_processing_jobs(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.claim_next_photo_processing_job() to authenticated;

drop policy if exists photo_processing_jobs_authenticated_read on public.photo_processing_jobs;
create policy photo_processing_jobs_authenticated_read
  on public.photo_processing_jobs
  for select
  to authenticated
  using (true);

drop policy if exists photo_processing_jobs_authenticated_insert on public.photo_processing_jobs;
create policy photo_processing_jobs_authenticated_insert
  on public.photo_processing_jobs
  for insert
  to authenticated
  with check (true);

drop policy if exists photo_processing_jobs_authenticated_update on public.photo_processing_jobs;
create policy photo_processing_jobs_authenticated_update
  on public.photo_processing_jobs
  for update
  to authenticated
  using (true)
  with check (true);
