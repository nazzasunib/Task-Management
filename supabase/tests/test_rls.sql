\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','a@x.com','{"full_name":"Alice"}'),
 ('00000000-0000-0000-0000-0000000000b2','b@x.com','{}');
select set_config('role','authenticated',false), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into public.tm_tasks(user_id,id,title,original_date,current_day) values (auth.uid(),'t1','A task','2026-09-25','2026-09-25');
insert into public.tm_note_categories(user_id,id,name) values (auth.uid(),'c1','Seminar');
update public.tm_profiles set full_name='Alice A', seeded=true;
do $$ begin
  begin insert into public.tm_tasks(user_id,id,title,original_date,current_day) values ('00000000-0000-0000-0000-0000000000b2','x','hack','2026-09-25','2026-09-25'); raise exception 'FAIL insert other';
  exception when insufficient_privilege then raise notice 'OK cross-user insert blocked'; end;
  begin update public.tm_profiles set email='z@z'; raise exception 'FAIL email';
  exception when insufficient_privilege then raise notice 'OK email not editable'; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select count(*) as b_sees_tasks from public.tm_tasks;
select count(*) as b_sees_profiles from public.tm_profiles;
update public.tm_tasks set title='pwned';
delete from public.tm_note_categories;
reset role;
select title, (select count(*) from public.tm_note_categories) cats, (select full_name from public.tm_profiles where email='a@x.com') from public.tm_tasks;
