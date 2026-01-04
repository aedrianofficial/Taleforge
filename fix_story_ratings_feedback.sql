-- Fix story_ratings table and add missing RLS policies
-- This resolves the "Could not find the 'feedback' column" error

-- Add feedback column to story_ratings table if it doesn't exist
ALTER TABLE public.story_ratings
ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Enable RLS on story_ratings if not already enabled
ALTER TABLE public.story_ratings ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own ratings
CREATE POLICY "Users can manage own ratings"
ON public.story_ratings
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow anyone to read ratings (for displaying average ratings)
CREATE POLICY "Anyone can read ratings"
ON public.story_ratings
FOR SELECT
USING (true);

-- Enable RLS on story_progress if not already enabled
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own progress
CREATE POLICY "Users can manage own progress"
ON public.story_progress
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to read their own progress
CREATE POLICY "Users can read own progress"
ON public.story_progress
FOR SELECT
USING (user_id = auth.uid());
