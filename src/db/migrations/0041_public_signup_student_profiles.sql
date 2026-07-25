insert into profiles (user_id, role)
select u.id, 'student'::role
from users u
left join profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;--> statement-breakpoint

create or replace function create_student_profile_for_user()
returns trigger
language plpgsql
as $$
begin
  insert into profiles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;

  return new;
end;
$$;--> statement-breakpoint

drop trigger if exists users_create_student_profile on users;--> statement-breakpoint

create trigger users_create_student_profile
after insert on users
for each row
execute function create_student_profile_for_user();
