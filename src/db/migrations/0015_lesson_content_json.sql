alter type lesson_type add value if not exists 'text';

alter table lessons
add column if not exists content_json jsonb;
