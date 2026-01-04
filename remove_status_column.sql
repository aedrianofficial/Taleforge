-- Remove the duplicate status column and simplify to use only is_published

-- First, ensure all existing logic is preserved by setting is_published based on status
UPDATE public.stories
SET is_published = CASE
  WHEN status = 'published' THEN true
  ELSE false
END
WHERE is_published IS NULL OR is_published = false;

-- Drop the status column
ALTER TABLE public.stories DROP COLUMN IF EXISTS status;

-- Update RLS policies to use is_published instead of status
DROP POLICY IF EXISTS "Users can read story parts" ON public.story_parts;
DROP POLICY IF EXISTS "Users can read story choices" ON public.story_choices;
DROP POLICY IF EXISTS "Users can create story parts for own stories" ON public.story_parts;
DROP POLICY IF EXISTS "Users can update parts of own stories" ON public.story_parts;

-- New simplified policies using is_published
CREATE POLICY "Users can read story parts"
ON public.story_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_parts.story_id
    AND (s.is_published = true
         OR s.author_id = auth.uid()
         OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
         )
    )
  )
);

CREATE POLICY "Users can read story choices"
ON public.story_choices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.story_parts sp
    JOIN public.stories s ON s.id = sp.story_id
    WHERE sp.id = story_choices.part_id
    AND (s.is_published = true
         OR s.author_id = auth.uid()
         OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
         )
    )
  )
);

CREATE POLICY "Users can create story parts for own stories"
ON public.story_parts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_parts.story_id
    AND s.author_id = auth.uid()
  )
);

CREATE POLICY "Users can update parts of own stories"
ON public.story_parts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_parts.story_id
    AND s.author_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_parts.story_id
    AND s.author_id = auth.uid()
  )
);

-- Update admin policies
DROP POLICY IF EXISTS "Admins can manage all story parts" ON public.story_parts;
DROP POLICY IF EXISTS "Admins can manage all story choices" ON public.story_choices;

CREATE POLICY "Admins can manage all story parts"
ON public.story_parts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "Admins can manage all story choices"
ON public.story_choices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);
