alter table lessons add column if not exists video_duration_seconds integer default 0 not null;
alter table lessons add column if not exists text_duration_seconds integer default 0 not null;
alter table lessons add column if not exists text_word_count integer default 0 not null;

update lessons
set video_duration_seconds = greatest(0, duration_seconds),
    text_duration_seconds = 0,
    text_word_count = 0
where video_duration_seconds = 0
  and text_duration_seconds = 0
  and text_word_count = 0
  and duration_seconds > 0;

update lessons
set duration_seconds = video_duration_seconds + text_duration_seconds;

do $$ begin
  alter table lessons
    add constraint lessons_video_duration_seconds_non_negative
    check (video_duration_seconds >= 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table lessons
    add constraint lessons_text_duration_seconds_non_negative
    check (text_duration_seconds >= 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table lessons
    add constraint lessons_text_word_count_non_negative
    check (text_word_count >= 0);
exception
  when duplicate_object then null;
end $$;
