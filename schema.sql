create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2),
  rating numeric(3,2) default 0,
  stock integer not null default 0 check (stock >= 0),
  badge text default 'New',
  description text default '',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, phone text not null, line1 text not null, line2 text,
  city text not null, state text not null, pincode text not null, landmark text,
  is_default boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Packed','Shipped','Delivered','Cancelled','Payment Failed')),
  payment_status text not null default 'Pending' check (payment_status in ('Pending','Paid','Failed','Refunded')),
  payment_id text, razorpay_order_id text,
  subtotal numeric(12,2) not null default 0, shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0, currency text not null default 'INR',
  shipping_address jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id), name text not null, price numeric(12,2) not null,
  quantity integer not null check (quantity > 0), image_url text
);
create index if not exists order_items_order_idx on public.order_items(order_id);

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "public can read active products" on public.products for select using (active = true);
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users upsert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users manage own addresses" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own orders" on public.orders for select using (auth.uid() = user_id);
create policy "users read own order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

insert into public.products (name,category,price,old_price,rating,stock,badge,description)
select * from (values
 ('Smartphone Pro X','Electronics',24999,29999,4.7,24,'Bestseller','Fast everyday smartphone with a vivid display, capable camera and all-day battery.'),
 ('Wireless Headphones','Electronics',1999,2999,4.5,42,'Hot Deal','Comfortable wireless headphones with rich sound and long battery life.'),
 ('Classic Running Shoes','Fashion',1799,2499,4.4,35,'Trending','Lightweight everyday running shoes designed for comfort and movement.'),
 ('Smart Watch Series 5','Electronics',3499,4999,4.6,19,'Popular','Track activity, notifications and daily routines from your wrist.'),
 ('Everyday Backpack','Fashion',999,1499,4.3,51,'Value Pick','Spacious, durable backpack for work, college and travel.'),
 ('Coffee Maker','Home',2299,3299,4.2,17,'Deal','Simple home coffee maker for fresh coffee whenever you want.'),
 ('LED Desk Lamp','Home',699,999,4.4,63,'Bestseller','Adjustable LED desk lamp with a clean modern look.'),
 ('Skincare Essentials','Beauty',1299,1799,4.5,29,'New','A convenient daily skincare essentials set.')
) as v(name,category,price,old_price,rating,stock,badge,description)
where not exists (select 1 from public.products);
