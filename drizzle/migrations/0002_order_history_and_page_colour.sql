alter table public.orders add column if not exists color_pages integer not null default 0;
alter table public.order_files add column if not exists color_pages integer not null default 0;
alter table public.order_files add column if not exists color_page_list text not null default '';

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
alter table public.order_events enable row level security;
create policy "Admins read events" on public.order_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_order_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id, status, note) values (new.id, new.status, 'Order received');
  elsif new.status is distinct from old.status then
    insert into public.order_events(order_id, status, note) values (new.id, new.status,
      case new.status when 'approved' then 'Approved and added to the print queue'
        when 'printing' then 'Printing started'
        when 'completed' then 'Ready for collection'
        when 'rejected' then coalesce(nullif(new.reject_reason,''),'Order declined')
        else 'Status changed' end);
  end if;
  return new;
end $$;

create trigger orders_log_event after insert or update on public.orders
for each row execute function public.log_order_event();

insert into public.order_events(order_id, status, note, created_at)
select id, 'pending', 'Order received', created_at from public.orders;