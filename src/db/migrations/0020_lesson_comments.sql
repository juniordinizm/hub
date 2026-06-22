do $$ begin
  create type lesson_comment_status as enum ('visible', 'hidden');
exception
  when duplicate_object then null;
end $$;

create table if not exists lesson_comments (
  id uuid primary key default gen_random_uuid() not null,
  lesson_id uuid not null references lessons(id) on delete cascade,
  author_user_id text references users(id) on delete set null,
  parent_id uuid references lesson_comments(id) on delete cascade,
  body text not null,
  status lesson_comment_status default 'visible' not null,
  hidden_by_user_id text references users(id) on delete set null,
  hidden_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists lesson_comments_lesson_created_idx
  on lesson_comments (lesson_id, created_at);

create index if not exists lesson_comments_parent_created_idx
  on lesson_comments (parent_id, created_at);

create index if not exists lesson_comments_author_idx
  on lesson_comments (author_user_id);
