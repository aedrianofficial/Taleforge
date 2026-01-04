// Story-related TypeScript types

export interface Story {
  id: string;
  title: string;
  description?: string;
  author_id?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Additional fields for UI
  cover_image?: string;
  genre?: string;
  estimated_duration?: number; // in minutes
  average_rating?: number;
  total_ratings?: number;
  author_name?: string;
  submitted_at?: string;
}

export interface StoryPart {
  id: string;
  story_id: string;
  content: string;
  is_start: boolean;
  is_ending: boolean;
  created_at: string;
}

export interface StoryChoice {
  id: string;
  part_id: string;
  choice_text: string;
  next_part_id: string;
  order_index: number;
}

export interface StoryProgress {
  id: string;
  user_id: string;
  story_id: string;
  current_part_id?: string;
  completed: boolean;
  updated_at: string;
}

export interface StoryRating {
  id: string;
  user_id: string;
  story_id: string;
  rating: number; // 1-5
  feedback?: string;
  created_at: string;
}

export interface StoryReaction {
  id: string;
  user_id: string;
  story_id: string;
  reaction_type: string;
  created_at: string;
}

// Combined types for UI components
export interface StoryWithProgress extends Story {
  progress?: StoryProgress;
  user_rating?: StoryRating;
}

export interface StoryPartWithChoices extends StoryPart {
  choices: StoryChoice[];
}

// Navigation and state types
export type StoryScreen = 'browse' | 'detail' | 'reading' | 'ending';

export interface ReadingState {
  currentPart: StoryPartWithChoices;
  story: Story;
  progress: StoryProgress;
}
