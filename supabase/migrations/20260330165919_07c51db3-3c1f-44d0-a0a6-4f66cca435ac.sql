create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  phone text not null,
  body text default '',
  is_from_me boolean default false,
  timestamp timestamptz default now(),
  raw_data jsonb,
  created_at timestamptz default now()
);

alter table public.whatsapp_messages enable row level security;

create policy "Allow all access to whatsapp_messages"
on public.whatsapp_messages
for all
using (true)
with check (true);

create index idx_whatsapp_messages_phone on public.whatsapp_messages(phone);
create index idx_whatsapp_messages_timestamp on public.whatsapp_messages(timestamp desc);