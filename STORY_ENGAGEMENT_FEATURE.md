# Story Engagement Tracking Feature

## Overview
This feature adds comprehensive user engagement tracking to the story reading experience. After completing a story, users now see a summary of their journey and can provide comprehension feedback.

## Database Changes

### New Table: `user_story_paths`
```sql
CREATE TABLE IF NOT EXISTS public.user_story_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  story_path JSONB NOT NULL, -- Array of story choices and timestamps
  comprehension_response TEXT, -- User's comprehension answer
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, story_id)
);
```

### Setup Instructions
1. Run the SQL in `user_story_engagement.sql` in your Supabase SQL editor
2. The table includes proper RLS policies for user privacy

## New TypeScript Types
- `UserStoryPath`: Complete user story engagement data
- `StoryPathEntry`: Individual choice/timestamp data

## UI Changes

### Story Reading Screen (`app/(user)/story-reading/[storyId].tsx`)
- Tracks all user choices in real-time
- Records timestamps for each decision
- Passes complete story path to ending screen

### Story Ending Screen (`app/(user)/story-ending/[storyId].tsx`)
- **Enhanced Story Summary Section**:
  - Displays user's complete journey through numbered parts with choices
  - **Toggle Feature**: "View More" / "Hide" button with smooth animations
  - **Collapsed View**: Shows choice summaries with truncated previews (100 chars)
  - **Expanded View**: Shows complete story text for each part in scrollable container
- **Fixed Layout**: 400px height container for expanded content prevents page height changes
- **Smart Scrolling**: Main page ScrollView always active, inner ScrollView contained within fixed bounds
- **No Layout Shifts**: Expanding/collapsing doesn't affect overall page scrollbar behavior
- **Duplicate Prevention**: Unique story path filtering ensures each part appears only once
- **New Comprehension Question**: "What did you understand from this story?"
- Saves both story path and comprehension response to database

## User Experience Flow
1. User reads story and makes choices (tracked automatically)
2. Upon completion, user sees congratulatory message
3. **NEW**: Story summary shows choice overview (collapsed by default)
4. **NEW**: User can click "View More" to expand and see complete narrative in scrollable container
5. **NEW**: Click "Hide" to collapse back to summary view
6. **NEW**: Comprehension question prompts reflection
7. Rating section (unchanged)
8. Data saved for admin review

## Admin Benefits
- **Complete Choice Tracking**: See exactly which paths users took
- **Comprehension Analysis**: Review user understanding and interpretations
- **Engagement Metrics**: Analyze decision patterns and story effectiveness

## Data Structure
The `story_path` JSONB field contains an array like:
```json
[
  {
    "part_id": "uuid",
    "choice_id": "uuid",
    "choice_text": "I chose the mysterious door",
    "timestamp": "2024-01-08T10:30:00Z",
    "part_content": "You stand before two doors..."
  }
]
```

## Files Modified
- `src/types/stories.ts` - Added new TypeScript interfaces
- `app/(user)/story-reading/[storyId].tsx` - Added choice tracking
- `app/(user)/story-ending/[storyId].tsx` - Enhanced summary UI with toggle functionality
- `user_story_engagement.sql` - Database schema

## Next Steps
1. Deploy database changes to production
2. Test the complete user flow
3. Consider adding analytics dashboard for admins to review engagement data
