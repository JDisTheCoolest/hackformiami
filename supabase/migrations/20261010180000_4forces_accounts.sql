-- 4forces account, reporting, alerts, and private notification data.
create extension if not exists pgcrypto;

create type public.force_category as enum ('water', 'air', 'land', 'fire');
create type public.incident_severity as enum ('none', 'low', 'moderate', 'severe');
create type public.report_state as enum ('submitted', 'reviewing', 'verified', 'resolved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  force public.force_category not null, title text not null check (char_length(title) between 3 and 140), description text not null check (char_length(description) between 3 and 4000),
  latitude double precision not null check (latitude between -90 and 90), longitude double precision not null check (longitude between -180 and 180),
  severity public.incident_severity not null default 'low', status public.report_state not null default 'submitted',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), force public.force_category not null, title text not null check (char_length(title) between 3 and 140), description text not null check (char_length(description) between 3 and 4000),
  severity public.incident_severity not null, latitude double precision check (latitude between -90 and 90), longitude double precision check (longitude between -180 and 180),
  trusted_source text, is_verified boolean not null default false, created_at timestamptz not null default now()
);
create table public.user_alerts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, alert_id uuid not null references public.alerts(id) on delete cascade,
  is_read boolean not null default false, is_saved boolean not null default false, notified_at timestamptz, created_at timestamptz not null default now(), primary key (user_id, alert_id)
);
create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  water_enabled boolean not null default true, air_enabled boolean not null default true, land_enabled boolean not null default true, fire_enabled boolean not null default true,
  push_enabled boolean not null default false, email_enabled boolean not null default true, alert_radius_km numeric(6,2) not null default 10 check (alert_radius_km between 0.5 and 250), updated_at timestamptz not null default now()
);
create table public.saved_locations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100), latitude double precision not null check (latitude between -90 and 90), longitude double precision not null check (longitude between -180 and 180), created_at timestamptz not null default now()
);
create table public.report_attachments (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.incident_reports(id) on delete cascade,
  storage_path text not null unique check (storage_path like auth.uid()::text || '/%'), content_type text not null check (content_type like 'image/%'), created_at timestamptz not null default now()
);
create index incident_reports_user_created_idx on public.incident_reports(user_id, created_at desc);
create index alerts_created_idx on public.alerts(created_at desc);
create index saved_locations_user_idx on public.saved_locations(user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger reports_updated before update on public.incident_reports for each row execute function public.set_updated_at();
create trigger preferences_updated before update on public.notification_preferences for each row execute function public.set_updated_at();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, nullif(new.raw_user_meta_data->>'display_name', '')) on conflict do nothing;
insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security; alter table public.incident_reports enable row level security; alter table public.alerts enable row level security; alter table public.user_alerts enable row level security; alter table public.notification_preferences enable row level security; alter table public.saved_locations enable row level security; alter table public.report_attachments enable row level security;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own reports" on public.incident_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'submitted');
create policy "read alerts" on public.alerts for select to authenticated using (true);
create policy "own alert state" on public.user_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own locations" on public.saved_locations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own report attachments" on public.report_attachments for all using (exists (select 1 from public.incident_reports r where r.id = report_id and r.user_id = auth.uid())) with check (exists (select 1 from public.incident_reports r where r.id = report_id and r.user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('report-images', 'report-images', false, 10485760, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "upload own report image" on storage.objects for insert to authenticated with check (bucket_id = 'report-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own report image" on storage.objects for select to authenticated using (bucket_id = 'report-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own report image" on storage.objects for delete to authenticated using (bucket_id = 'report-images' and (storage.foldername(name))[1] = auth.uid()::text);
