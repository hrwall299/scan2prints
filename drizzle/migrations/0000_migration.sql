create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- first registered account becomes shop admin
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where role = 'admin') $$;
grant execute on function public.admin_exists() to anon, authenticated;

create table public.shop_settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'PRINTORA Print Shop',
  bw_price numeric(10,2) not null default 2,
  color_price numeric(10,2) not null default 10,
  a3_multiplier numeric(5,2) not null default 2,
  glossy_surcharge numeric(10,2) not null default 5,
  duplex_discount numeric(5,2) not null default 0,
  max_file_mb int not null default 25,
  cleanup_hours int not null default 24,
  currency text not null default '₹',
  updated_at timestamptz not null default now()
);
grant select on public.shop_settings to anon, authenticated;
grant update on public.shop_settings to authenticated;
grant all on public.shop_settings to service_role;
alter table public.shop_settings enable row level security;
create policy "Anyone reads settings" on public.shop_settings for select to anon, authenticated using (true);
create policy "Admins update settings" on public.shop_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.shop_settings(id) values (1);

create table public.printers (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique check (kind in ('bw','color')),
  name text not null,
  model text not null default '',
  connection text not null default 'USB',
  status text not null default 'online' check (status in ('online','offline','paused','maintenance')),
  default_paper text not null default 'A4',
  quality text not null default 'normal',
  duplex boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select, update on public.printers to authenticated;
grant all on public.printers to service_role;
alter table public.printers enable row level security;
create policy "Admins read printers" on public.printers for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins update printers" on public.printers for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.printers(kind,name,model) values ('bw','Mono Laser','HP LaserJet Pro'),('color','Colour Inkjet','Epson EcoTank');

create sequence public.order_number_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('public.order_number_seq'),
  tracking_token text not null,
  mode text not null check (mode in ('document','image')),
  customer_name text not null,
  customer_phone text not null default '',
  notes text not null default '',
  color_mode text not null check (color_mode in ('bw','color')),
  copies int not null check (copies between 1 and 500),
  page_size text not null default 'A4',
  paper_type text not null default 'standard',
  sides text not null default 'single',
  layout text not null default 'standard',
  page_count int not null default 1,
  estimated_price numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','printing','completed','rejected')),
  reject_reason text not null default '',
  queue_position double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  files_deleted_at timestamptz
);
grant select, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Admins read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "Admins delete orders" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  page_count int not null default 1,
  kind text not null default 'original',
  created_at timestamptz not null default now()
);
create index on public.order_files(order_id);
grant select on public.order_files to authenticated;
grant all on public.order_files to service_role;
alter table public.order_files enable row level security;
create policy "Admins read files" on public.order_files for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

alter table public.orders replica identity full;
alter publication supabase_realtime add table public.orders;