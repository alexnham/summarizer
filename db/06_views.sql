-- 06_views.sql
create or replace view public.summary_with_profile as
select s.*, p.name as user_name, p.email as user_email
from public.summaries s
left join public.profiles p on p.id = s.user_id;
