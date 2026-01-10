-- =================================================================================
-- COMPLETE GUIDE: TRUNCATE ALL TABLES IN TALEFORGE APP
-- =================================================================================
-- 
-- WARNING: THIS WILL PERMANENTLY DELETE ALL DATA!
-- Make sure you have backups before running this.
--
-- ALL TABLES USED IN THE APP:
-- 1. users (base table - user accounts)
-- 2. posts (user posts)
-- 3. post_reactions (reactions to posts)
-- 4. post_ratings (ratings for posts)
-- 5. stories (interactive stories)
-- 6. story_parts (parts of stories)
-- 7. story_choices (choices in story parts)
-- 8. story_reactions (reactions to stories)
-- 9. story_ratings (ratings for stories)
-- 10. story_progress (user reading progress)
-- 11. user_story_paths (user story paths and reflections)
-- 12. story_audit_log (audit trail for changes)
-- 13. avatars (user profile pictures)
-- 14. support_messages (support chat messages)
--
-- FOREIGN KEY RELATIONSHIPS:
-- posts → users
-- post_reactions → posts, users
-- post_ratings → posts, users
-- stories → users
-- story_parts → stories, users
-- story_choices → story_parts, users
-- story_reactions → stories, users
-- story_ratings → stories, users
-- story_progress → stories, users, story_parts
-- user_story_paths → stories, users
-- story_audit_log → stories, story_parts, story_choices, users
-- avatars → users
-- support_messages → users
--
-- =================================================================================

-- OPTION 1: TRUNCATE ALL CONTENT BUT KEEP USERS (RECOMMENDED FOR TESTING)
-- This preserves user accounts but removes all posts, stories, reactions, etc.

BEGIN;

-- Disable foreign key constraints temporarily
SET session_replication_role = 'replica';

-- Truncate all content tables in correct dependency order
TRUNCATE TABLE public.story_audit_log CASCADE;
TRUNCATE TABLE public.story_choices CASCADE;
TRUNCATE TABLE public.story_progress CASCADE;
TRUNCATE TABLE public.story_reactions CASCADE;
TRUNCATE TABLE public.story_ratings CASCADE;
TRUNCATE TABLE public.user_story_paths CASCADE;
TRUNCATE TABLE public.story_parts CASCADE;
TRUNCATE TABLE public.stories CASCADE;
TRUNCATE TABLE public.post_reactions CASCADE;
TRUNCATE TABLE public.post_ratings CASCADE;
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.support_messages CASCADE;
TRUNCATE TABLE public.avatars CASCADE;

-- Re-enable foreign key constraints
SET session_replication_role = 'origin';

COMMIT;

-- =================================================================================

-- OPTION 2: TRUNCATE EVERYTHING INCLUDING USERS (COMPLETE RESET)
-- WARNING: This will delete all user accounts too!

BEGIN;
-- 
-- -- Disable foreign key constraints temporarily
-SET session_replication_role = 'replica';
-- 
-- -- Truncate all tables
TRUNCATE TABLE public.story_audit_log CASCADE;
TRUNCATE TABLE public.story_choices CASCADE;
TRUNCATE TABLE public.story_progress CASCADE;
TRUNCATE TABLE public.story_reactions CASCADE;
TRUNCATE TABLE public.story_ratings CASCADE;
TRUNCATE TABLE public.user_story_paths CASCADE;
TRUNCATE TABLE public.story_parts CASCADE;
TRUNCATE TABLE public.stories CASCADE;
TRUNCATE TABLE public.post_reactions CASCADE;
TRUNCATE TABLE public.post_ratings CASCADE;
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.support_messages CASCADE;
TRUNCATE TABLE public.avatars CASCADE;
TRUNCATE TABLE public.users CASCADE;
-- 
-- -- Re-enable foreign key constraints
SET session_replication_role = 'origin';
-- 
COMMIT;

-- =================================================================================

-- WILL FUNCTIONS BREAK AFTER TRUNCATION?
-- 
-- NO - The app functions will continue to work normally after truncation because:
-- 
-- 1. Table structures remain intact (only data is removed)
-- 2. All foreign key constraints are preserved
-- 3. Row Level Security (RLS) policies remain active
-- 4. Functions and triggers continue to work
-- 5. The app will simply show empty states (no posts, no stories, etc.)
-- 
-- WHAT HAPPENS IN THE APP:
-- - Board will show "No posts yet"
-- - Stories list will show "No stories yet"
-- - Profile pages will show zero counts
-- - All reaction/rating counts will be zero
-- - User story paths and reflections will be cleared
-- - Story completion data will be reset
-- - User accounts remain (if not truncated)
-- - All UI components will display correctly with empty data
-- 
-- =================================================================================
