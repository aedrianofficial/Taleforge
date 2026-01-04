-- Fix Row Level Security policies for story creation and management

-- Allow users to create their own stories
create policy "Users can create own stories"
on public.stories
for insert
with check ( author_id = auth.uid() );

-- Allow users to update their own stories
create policy "Users can update own stories"
on public.stories
for update
using ( author_id = auth.uid() )
with check ( author_id = auth.uid() );

-- Allow users to delete their own stories
create policy "Users can delete own stories"
on public.stories
for delete
using ( author_id = auth.uid() );

-- Allow users to read their own stories (draft and published)
create policy "Users can read own stories"
on public.stories
for select
using (
  author_id = auth.uid()
  or is_published = true
  or exists (
    select 1 from public.users
    where users.id = auth.uid()
    and users.is_admin = true
  )
);

-- Allow users to manage story parts for their own stories
create policy "Users can manage parts of own stories"
on public.story_parts
for all
using (
  exists (
    select 1 from public.stories s
    where s.id = story_parts.story_id
    and s.author_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stories s
    where s.id = story_parts.story_id
    and s.author_id = auth.uid()
  )
);

-- Allow users to manage story choices for their own stories
create policy "Users can manage choices of own stories"
on public.story_choices
for all
using (
  exists (
    select 1 from public.story_parts sp
    join public.stories s on s.id = sp.story_id
    where sp.id = story_choices.part_id
    and s.author_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.story_parts sp
    join public.stories s on s.id = sp.story_id
    where sp.id = story_choices.part_id
    and s.author_id = auth.uid()
  )
);
