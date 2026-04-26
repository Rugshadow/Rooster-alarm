import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string;
          username: string;
          profile_photo: string | null;
          set_alarms: object | null;
          language: string | null;
          favorite_channels: string[];
          favorite_samples: string[];
          history: string[];
          uploads: string[];
          archived_uploads: string[];
          followers: string[];
          num_of_followers: number;
          content_order: string;
          time_format: string;
          created_at: string;
        };
      };
      audio_files: {
        Row: {
          audio_id: string;
          title: string;
          cover_photo: string | null;
          uploaded_by: string;
          audio_file: string;
          created_at: string;
          release_at: string | null;
          language: string | null;
          genre: string;
          num_of_plays: number;
          duration_seconds: number;
        };
      };
      user_reports: {
        Row: {
          id: string;
          reported_user_id: string;
          reported_user_username: string;
          reported_user_email: string;
          reporting_user_id: string;
          reporting_user_username: string;
          reporting_user_email: string;
          stated_reason: string;
          timestamp: string;
        };
      };
    };
  };
};
