alter table "modules" add column "status" "course_status" default 'draft' not null;

update "modules"
set "status" = 'active';

alter table "lessons" add column "status" "course_status" default 'draft' not null;

update "lessons"
set "status" = case
  when "is_published" then 'active'::"course_status"
  else 'draft'::"course_status"
end;
