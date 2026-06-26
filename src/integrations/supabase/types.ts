export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          avg_speed_kmh: number | null
          calories: number | null
          created_at: string
          distance_m: number
          duration_s: number
          ended_at: string | null
          id: string
          kind: string
          max_speed_kmh: number | null
          route: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          avg_speed_kmh?: number | null
          calories?: number | null
          created_at?: string
          distance_m?: number
          duration_s?: number
          ended_at?: string | null
          id?: string
          kind: string
          max_speed_kmh?: number | null
          route?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          avg_speed_kmh?: number | null
          calories?: number | null
          created_at?: string
          distance_m?: number
          duration_s?: number
          ended_at?: string | null
          id?: string
          kind?: string
          max_speed_kmh?: number | null
          route?: Json | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          structured: Json | null
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          structured?: Json | null
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          structured?: Json | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_message_preview: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          last_message_preview?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_message_preview?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_profiles: {
        Row: {
          coach_id: string
          created_at: string
          goals: Json
          id: string
          onboarding_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          goals?: Json
          id?: string
          onboarding_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          goals?: Json
          id?: string
          onboarding_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          ai_response: string | null
          created_at: string
          date: string
          energy: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          user_id: string
          water_glasses: number | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          user_id: string
          water_glasses?: number | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          user_id?: string
          water_glasses?: number | null
        }
        Relationships: []
      }
      health_assessments: {
        Row: {
          activity_score: number | null
          ai_summary: string | null
          bmi: number | null
          cardio_score: number | null
          created_at: string
          id: string
          mental_score: number | null
          nutrition_score: number | null
          overall_score: number
          priority_actions: string[] | null
          raw_json: Json | null
          risks: string[] | null
          sleep_score: number | null
          strengths: string[] | null
          user_id: string
        }
        Insert: {
          activity_score?: number | null
          ai_summary?: string | null
          bmi?: number | null
          cardio_score?: number | null
          created_at?: string
          id?: string
          mental_score?: number | null
          nutrition_score?: number | null
          overall_score: number
          priority_actions?: string[] | null
          raw_json?: Json | null
          risks?: string[] | null
          sleep_score?: number | null
          strengths?: string[] | null
          user_id: string
        }
        Update: {
          activity_score?: number | null
          ai_summary?: string | null
          bmi?: number | null
          cardio_score?: number | null
          created_at?: string
          id?: string
          mental_score?: number | null
          nutrition_score?: number | null
          overall_score?: number
          priority_actions?: string[] | null
          raw_json?: Json | null
          risks?: string[] | null
          sleep_score?: number | null
          strengths?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      health_memories: {
        Row: {
          category: string
          confirmed_by_user: boolean
          created_at: string
          id: string
          label: string
          sensitive: boolean
          source_thread_id: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          confirmed_by_user?: boolean
          created_at?: string
          id?: string
          label: string
          sensitive?: boolean
          source_thread_id?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          confirmed_by_user?: boolean
          created_at?: string
          id?: string
          label?: string
          sensitive?: boolean
          source_thread_id?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      health_trackers: {
        Row: {
          created_at: string
          emoji: string | null
          ended_at: string | null
          frequency_days: number
          id: string
          linked_coach_id: string | null
          metrics: Json | null
          photo_guidance: string | null
          plan: Json
          status: string
          summary: string | null
          thread_id: string | null
          title: string
          updated_at: string
          user_id: string
          voice_enabled: boolean
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          ended_at?: string | null
          frequency_days?: number
          id?: string
          linked_coach_id?: string | null
          metrics?: Json | null
          photo_guidance?: string | null
          plan?: Json
          status?: string
          summary?: string | null
          thread_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          voice_enabled?: boolean
        }
        Update: {
          created_at?: string
          emoji?: string | null
          ended_at?: string | null
          frequency_days?: number
          id?: string
          linked_coach_id?: string | null
          metrics?: Json | null
          photo_guidance?: string | null
          plan?: Json
          status?: string
          summary?: string | null
          thread_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "health_trackers_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      hydration_logs: {
        Row: {
          amount_ml: number
          created_at: string
          goal_ml: number
          id: string
          log_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_ml?: number
          created_at?: string
          goal_ml?: number
          id?: string
          log_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          goal_ml?: number
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          mood: number
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          mood: number
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          mood?: number
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          kcal: number
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g: number
          created_at?: string
          fat_g: number
          kcal: number
          protein_g: number
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          kcal?: number
          protein_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string[] | null
          birthdate: string | null
          conditions: string[] | null
          created_at: string
          display_name: string | null
          goals: string[] | null
          health_score: number
          height_cm: number | null
          last_active_date: string | null
          level: number
          medications: string[] | null
          memory_enabled: boolean
          onboarded: boolean
          sex: string | null
          streak_days: number
          updated_at: string
          user_id: string
          weight_kg: number | null
          xp: number
        }
        Insert: {
          allergies?: string[] | null
          birthdate?: string | null
          conditions?: string[] | null
          created_at?: string
          display_name?: string | null
          goals?: string[] | null
          health_score?: number
          height_cm?: number | null
          last_active_date?: string | null
          level?: number
          medications?: string[] | null
          memory_enabled?: boolean
          onboarded?: boolean
          sex?: string | null
          streak_days?: number
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          xp?: number
        }
        Update: {
          allergies?: string[] | null
          birthdate?: string | null
          conditions?: string[] | null
          created_at?: string
          display_name?: string | null
          goals?: string[] | null
          health_score?: number
          height_cm?: number | null
          last_active_date?: string | null
          level?: number
          medications?: string[] | null
          memory_enabled?: boolean
          onboarded?: boolean
          sex?: string | null
          streak_days?: number
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      run_plans: {
        Row: {
          active: boolean
          created_at: string
          goal: string
          id: string
          plan: Json
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          goal: string
          id?: string
          plan?: Json
          updated_at?: string
          user_id: string
          weeks?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          goal?: string
          id?: string
          plan?: Json
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      tracker_entries: {
        Row: {
          created_at: string
          data: Json | null
          ended_at: string | null
          feeling: number | null
          id: string
          kind: string
          metrics: Json
          note: string | null
          photo_url: string | null
          tracker_id: string
          user_id: string
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          ended_at?: string | null
          feeling?: number | null
          id?: string
          kind?: string
          metrics?: Json
          note?: string | null
          photo_url?: string | null
          tracker_id: string
          user_id: string
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          ended_at?: string | null
          feeling?: number | null
          id?: string
          kind?: string
          metrics?: Json
          note?: string | null
          photo_url?: string | null
          tracker_id?: string
          user_id?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracker_entries_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "health_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          period_end: string | null
          period_start: string | null
          title: string | null
          tracker_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          period_end?: string | null
          period_start?: string | null
          title?: string | null
          tracker_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          period_end?: string | null
          period_start?: string | null
          title?: string | null
          tracker_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_reports_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "health_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_programs: {
        Row: {
          active: boolean
          created_at: string
          goal: string
          id: string
          name: string
          plan: Json
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          goal: string
          id?: string
          name: string
          plan?: Json
          updated_at?: string
          user_id: string
          weeks?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          goal?: string
          id?: string
          name?: string
          plan?: Json
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          exercises: Json
          id: string
          notes: string | null
          program_id: string | null
          scheduled_date: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          exercises?: Json
          id?: string
          notes?: string | null
          program_id?: string | null
          scheduled_date?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          exercises?: Json
          id?: string
          notes?: string | null
          program_id?: string | null
          scheduled_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          event_type: string
          id: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          event_type: string
          id?: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
