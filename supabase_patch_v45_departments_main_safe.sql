-- Meridien POS: department isolation foundation
-- Run in Supabase SQL Editor before using the new Bar/Hall workflows.

alter table if exists public.orders
  add column if not exists department text;

alter table if exists public.expenses
  add column if not exists department text;

alter table if exists public.shift_closings
  add column if not exists department text;

alter table if exists public.daily_closings
  add column if not exists department text;

update public.orders
set department = case
  when lower(coalesce(hall, '')) like '%bar%'
    or lower(coalesce(hall, '')) like '%cafe%'
    or coalesce(hall, '') like '%بار%'
    or coalesce(hall, '') like '%كافيه%'
    then 'bar'
  else 'restaurant'
end
where department is null;

update public.expenses
set department = 'restaurant'
where department is null;

update public.shift_closings
set department = case
  when bucket = 'department:bar' then 'bar'
  else 'restaurant'
end
where department is null;

update public.daily_closings
set department = 'restaurant'
where department is null;

alter table public.orders
  drop constraint if exists orders_department_check;
alter table public.orders
  add constraint orders_department_check
  check (department in ('restaurant', 'bar'));

alter table public.expenses
  drop constraint if exists expenses_department_check;
alter table public.expenses
  add constraint expenses_department_check
  check (department in ('restaurant', 'bar'));

alter table public.shift_closings
  drop constraint if exists shift_closings_department_check;
alter table public.shift_closings
  add constraint shift_closings_department_check
  check (department in ('restaurant', 'bar'));

alter table public.daily_closings
  drop constraint if exists daily_closings_department_check;
alter table public.daily_closings
  add constraint daily_closings_department_check
  check (department in ('restaurant', 'bar'));

create index if not exists idx_orders_department
  on public.orders (department);
create index if not exists idx_expenses_department_date
  on public.expenses (department, expense_date);
create index if not exists idx_shift_closings_department_to_at
  on public.shift_closings (department, to_at desc);
create index if not exists idx_daily_closings_department_date
  on public.daily_closings (department, closing_date desc);

comment on column public.orders.department is 'Operational department: restaurant or bar';
comment on column public.expenses.department is 'Department charged for the expense: restaurant or bar';
comment on column public.shift_closings.department is 'Department that owns this closing';
comment on column public.daily_closings.department is 'Department that owns this daily closing';

-- Main Safe is intentionally a read-only aggregation in the UI at this stage:
-- it aggregates persisted closing rows without duplicating money movements.
-- No separate ledger table is required for this reporting view.
