-- Admin Story Workflow - Database Schema Updates

-- Add submission tracking
ALTER TABLE public.stories ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN reviewed_by UUID REFERENCES public.users(id);

-- Add admin modification tracking
ALTER TABLE public.story_parts ADD COLUMN created_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_parts ADD COLUMN modified_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_parts ADD COLUMN modified_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.story_choices ADD COLUMN created_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_choices ADD COLUMN modified_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_choices ADD COLUMN modified_at TIMESTAMPTZ DEFAULT now();

-- Create story audit log table for version history
CREATE TABLE public.story_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.story_parts(id) ON DELETE CASCADE,
  choice_id UUID REFERENCES public.story_choices(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject'
  field_changed TEXT, -- which field was modified
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES public.users(id),
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.story_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.story_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- Update existing policies to work with new status system
DROP POLICY IF EXISTS "Users can read published stories" ON public.stories;
DROP POLICY IF EXISTS "Admins can manage stories" ON public.stories;

-- New policies for story access
CREATE POLICY "Users can read published stories"
ON public.stories
FOR SELECT
USING (
  is_published = true
  OR author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "Users can create their own stories"
ON public.stories
FOR INSERT
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update their own unpublished stories"
ON public.stories
FOR UPDATE
USING (
  author_id = auth.uid()
  AND is_published = false
)
WITH CHECK (
  author_id = auth.uid()
  AND is_published = false
);

CREATE POLICY "Admins can manage all stories"
ON public.stories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- Update story parts policies
DROP POLICY IF EXISTS "Users can manage parts of own stories" ON public.story_parts;

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

-- Update story choices policies
DROP POLICY IF EXISTS "Users can manage choices of own stories" ON public.story_choices;

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

CREATE POLICY "Users can create choices for own story parts"
ON public.story_choices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.story_parts sp
    JOIN public.stories s ON s.id = sp.story_id
    WHERE sp.id = story_choices.part_id
    AND s.author_id = auth.uid()
    AND s.is_published = false
  )
);

CREATE POLICY "Users can update choices for own story parts"
ON public.story_choices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.story_parts sp
    JOIN public.stories s ON s.id = sp.story_id
    WHERE sp.id = story_choices.part_id
    AND s.author_id = auth.uid()
    AND s.is_published = false
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.story_parts sp
    JOIN public.stories s ON s.id = sp.story_id
    WHERE sp.id = story_choices.part_id
    AND s.author_id = auth.uid()
    AND s.is_published = false
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

-- Ensure all stories have proper is_published values
UPDATE public.stories SET is_published = false WHERE is_published IS NULL;

-- Set created_by for existing parts (assuming they were created by story authors)
UPDATE public.story_parts
SET created_by = stories.author_id
FROM public.stories
WHERE story_parts.story_id = stories.id;

-- Set created_by for existing choices
UPDATE public.story_choices
SET created_by = stories.author_id
FROM public.story_parts sp
JOIN public.stories stories ON stories.id = sp.story_id
WHERE story_choices.part_id = sp.id;
