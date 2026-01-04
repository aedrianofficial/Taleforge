-- Fix any missing columns in story tables
-- Run this if you encounter schema issues

-- Add missing columns to story_parts if they don't exist
ALTER TABLE public.story_parts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_parts ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_parts ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ DEFAULT now();

-- Add missing columns to story_choices if they don't exist
ALTER TABLE public.story_choices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_choices ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES public.users(id);
ALTER TABLE public.story_choices ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ DEFAULT now();

-- Add missing columns to stories if they don't exist
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected'));
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id);

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.story_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.story_parts(id) ON DELETE CASCADE,
  choice_id UUID REFERENCES public.story_choices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.story_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log
CREATE POLICY "Admins can read audit logs"
ON public.story_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

CREATE POLICY "System can insert audit logs"
ON public.story_audit_log
FOR INSERT
WITH CHECK (true);

-- Update existing data to have proper status
UPDATE public.stories SET status = 'published' WHERE is_published = true AND status IS NULL;
UPDATE public.stories SET status = 'draft' WHERE (is_published = false OR is_published IS NULL) AND status IS NULL;

-- Set created_by for existing parts
UPDATE public.story_parts
SET created_by = stories.author_id
FROM public.stories
WHERE story_parts.story_id = stories.id AND story_parts.created_by IS NULL;

-- Set created_by for existing choices
UPDATE public.story_choices
SET created_by = stories.author_id
FROM public.story_parts sp
JOIN public.stories stories ON stories.id = sp.story_id
WHERE story_choices.part_id = sp.id AND story_choices.created_by IS NULL;
