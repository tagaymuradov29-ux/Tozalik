-- Platforma bazasi. Har ishga tushganda xavfsiz qayta bajariladi (IF NOT EXISTS).

create table if not exists platforms (
  id serial primary key,
  slug text unique not null,
  name text not null,
  color text not null default '#0B5D46',
  tz text not null default 'Asia/Tashkent',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id serial primary key,
  platform_id int references platforms(id) on delete cascade,
  phone text not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('super','admin','curator','student')),
  group_id int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists users_platform_phone on users (coalesce(platform_id, 0), phone);

create table if not exists courses (
  id serial primary key,
  platform_id int not null references platforms(id) on delete cascade,
  title text not null,
  description text not null default '',
  points jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id serial primary key,
  platform_id int not null references platforms(id) on delete cascade,
  course_id int not null references courses(id) on delete cascade,
  name text not null,
  curator_id int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table users add constraint users_group_fk foreign key (group_id) references groups(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists invites (
  code text primary key,
  platform_id int not null references platforms(id) on delete cascade,
  role text not null check (role in ('admin','curator','student')),
  group_id int references groups(id) on delete cascade,
  created_by int references users(id) on delete set null,
  uses int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists lessons (
  id serial primary key,
  course_id int not null references courses(id) on delete cascade,
  n int not null,
  title text not null,
  speaker text not null default '',
  starts_at timestamptz not null,
  duration_min int not null default 240,
  video_url text not null default '',
  content text not null default '',
  materials jsonb not null default '[]',
  attendance boolean not null default true
);
create index if not exists lessons_course on lessons (course_id, n);

-- kind: file | text | link | workbook | repeat (stories/reels kabi har biri alohida birlik)
create table if not exists tasks (
  id serial primary key,
  course_id int not null references courses(id) on delete cascade,
  lesson_id int references lessons(id) on delete set null,
  title text not null,
  kind text not null default 'file',
  instructions text not null default '',
  max_points int not null default 10,
  late_points int,
  opens_at timestamptz,
  due_at timestamptz,
  review boolean not null default true,
  workbook jsonb,
  per_day int,
  per_week int,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tasks_course on tasks (course_id);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  platform_id int not null references platforms(id) on delete cascade,
  user_id int references users(id) on delete set null,
  name text not null,
  type text not null,
  size int not null,
  sha256 text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id serial primary key,
  task_id int not null references tasks(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  text text not null default '',
  link text not null default '',
  files jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  points int,
  late boolean not null default false,
  feedback text not null default '',
  graded_by int references users(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subs_task_user on submissions (task_id, user_id);
create index if not exists subs_status on submissions (status);

create table if not exists wb_answers (
  user_id int not null references users(id) on delete cascade,
  task_id int not null references tasks(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- status: ontime | late | absent | excused
create table if not exists attendance (
  lesson_id int not null references lessons(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  status text not null,
  late_min int not null default 0,
  src text not null default 'kod',
  reason text not null default '',
  marked_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

create table if not exists bonuses (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  points int not null,
  note text not null,
  by_id int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id bigserial primary key,
  group_id int not null references groups(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_group on messages (group_id, id);

create table if not exists video_progress (
  user_id int not null references users(id) on delete cascade,
  lesson_id int not null references lessons(id) on delete cascade,
  position int not null default 0,
  duration int not null default 0,
  max_pos int not null default 0,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists notifications (
  id bigserial primary key,
  user_id int not null references users(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_user on notifications (user_id, id desc);
