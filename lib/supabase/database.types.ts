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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      answer_log: {
        Row: {
          answered_at: string
          id: string
          learning_processed_at: string | null
          learning_rating: number | null
          learning_version: string | null
          mode: string | null
          personal_word_id: string | null
          question_type: string
          received_at: string
          response_ms: number | null
          result: string
          selected_extra_meaning_choice_id: string | null
          selected_personal_word_id: string | null
          selected_word_id: string | null
          time_limit_ms: number | null
          user_id: string
          word_id: string | null
        }
        Insert: {
          answered_at: string
          id: string
          learning_processed_at?: string | null
          learning_rating?: number | null
          learning_version?: string | null
          mode?: string | null
          personal_word_id?: string | null
          question_type: string
          received_at?: string
          response_ms?: number | null
          result: string
          selected_extra_meaning_choice_id?: string | null
          selected_personal_word_id?: string | null
          selected_word_id?: string | null
          time_limit_ms?: number | null
          user_id?: string
          word_id?: string | null
        }
        Update: {
          answered_at?: string
          id?: string
          learning_processed_at?: string | null
          learning_rating?: number | null
          learning_version?: string | null
          mode?: string | null
          personal_word_id?: string | null
          question_type?: string
          received_at?: string
          response_ms?: number | null
          result?: string
          selected_extra_meaning_choice_id?: string | null
          selected_personal_word_id?: string | null
          selected_word_id?: string | null
          time_limit_ms?: number | null
          user_id?: string
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_log_personal_word_fkey"
            columns: ["user_id", "personal_word_id"]
            isOneToOne: false
            referencedRelation: "personal_word"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "answer_log_selected_extra_meaning_choice_id_fkey"
            columns: ["selected_extra_meaning_choice_id"]
            isOneToOne: false
            referencedRelation: "extra_meaning_choice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_log_selected_personal_word_fkey"
            columns: ["user_id", "selected_personal_word_id"]
            isOneToOne: false
            referencedRelation: "personal_word"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "answer_log_selected_word_id_fkey"
            columns: ["selected_word_id"]
            isOneToOne: false
            referencedRelation: "word"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_log_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "word"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_meaning_choice: {
        Row: {
          created_at: string
          id: string
          label: string
          normalized_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          normalized_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          normalized_label?: string | null
        }
        Relationships: []
      }
      learner_state: {
        Row: {
          ability: number
          ability_count: number
          last_answer_id: string
          last_answered_at: string
          model_version: string
          precision: number
          review_count: number
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ability: number
          ability_count?: number
          last_answer_id: string
          last_answered_at: string
          model_version: string
          precision: number
          review_count: number
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          ability?: number
          ability_count?: number
          last_answer_id?: string
          last_answered_at?: string
          model_version?: string
          precision?: number
          review_count?: number
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meaning_distractor: {
        Row: {
          batch_id: string
          candidate_id: string
          candidate_source: string
          created_at: string
          question_type: string
          rank: number
          reason: string
          status: string
          target_word_id: string
        }
        Insert: {
          batch_id: string
          candidate_id: string
          candidate_source: string
          created_at?: string
          question_type?: string
          rank: number
          reason: string
          status?: string
          target_word_id: string
        }
        Update: {
          batch_id?: string
          candidate_id?: string
          candidate_source?: string
          created_at?: string
          question_type?: string
          rank?: number
          reason?: string
          status?: string
          target_word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meaning_distractor_target_word_id_fkey"
            columns: ["target_word_id"]
            isOneToOne: false
            referencedRelation: "word"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_word: {
        Row: {
          created_at: string
          deleted_at: string | null
          difficulty: number
          entry_type: string
          hanja_reading: string | null
          has_kanji: boolean
          id: string
          kana: string
          meaning_ko: string
          note: string | null
          pronunciation_ko: string | null
          term: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          difficulty?: number
          entry_type?: string
          hanja_reading?: string | null
          has_kanji: boolean
          id?: string
          kana: string
          meaning_ko: string
          note?: string | null
          pronunciation_ko?: string | null
          term: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          difficulty?: number
          entry_type?: string
          hanja_reading?: string | null
          has_kanji?: boolean
          id?: string
          kana?: string
          meaning_ko?: string
          note?: string | null
          pronunciation_ko?: string | null
          term?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentence: {
        Row: {
          batch: string
          created_at: string
          difficulty: number | null
          id: string
          status: string
          text_ja: string
          translation_ko: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          difficulty?: number | null
          id: string
          status?: string
          text_ja: string
          translation_ko: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          difficulty?: number | null
          id?: string
          status?: string
          text_ja?: string
          translation_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      sentence_option: {
        Row: {
          display_text: string
          id: string
          is_accepted: boolean
          reading: string | null
          reason_ko: string | null
          review_status: string
          socket_id: string
          word_id: string | null
        }
        Insert: {
          display_text: string
          id?: string
          is_accepted: boolean
          reading?: string | null
          reason_ko?: string | null
          review_status?: string
          socket_id: string
          word_id?: string | null
        }
        Update: {
          display_text?: string
          id?: string
          is_accepted?: boolean
          reading?: string | null
          reason_ko?: string | null
          review_status?: string
          socket_id?: string
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sentence_option_socket_id_fkey"
            columns: ["socket_id"]
            isOneToOne: false
            referencedRelation: "sentence_socket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentence_option_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "word"
            referencedColumns: ["id"]
          },
        ]
      }
      sentence_socket: {
        Row: {
          end_offset: number
          id: string
          original_text: string
          sentence_id: string
          start_offset: number
        }
        Insert: {
          end_offset: number
          id?: string
          original_text: string
          sentence_id: string
          start_offset: number
        }
        Update: {
          end_offset?: number
          id?: string
          original_text?: string
          sentence_id?: string
          start_offset?: number
        }
        Relationships: [
          {
            foreignKeyName: "sentence_socket_sentence_id_fkey"
            columns: ["sentence_id"]
            isOneToOne: false
            referencedRelation: "sentence"
            referencedColumns: ["id"]
          },
        ]
      }
      study_chest: {
        Row: {
          created_at: string
          id: string
          opened_at: string | null
          ordinal: number
          tier: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_at?: string | null
          ordinal: number
          tier?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_at?: string | null
          ordinal?: number
          tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      treasure_progress: {
        Row: {
          solved: number
          user_id: string
        }
        Insert: {
          solved?: number
          user_id: string
        }
        Update: {
          solved?: number
          user_id?: string
        }
        Relationships: []
      }
      word: {
        Row: {
          created_at: string
          deleted_at: string | null
          difficulty: number
          entry_type: string
          hanja_reading: string | null
          has_kanji: boolean
          id: string
          kana: string
          meaning_ko: string
          note: string | null
          pronunciation_ko: string | null
          term: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          difficulty?: number
          entry_type?: string
          hanja_reading?: string | null
          has_kanji: boolean
          id?: string
          kana: string
          meaning_ko: string
          note?: string | null
          pronunciation_ko?: string | null
          term: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          difficulty?: number
          entry_type?: string
          hanja_reading?: string | null
          has_kanji?: boolean
          id?: string
          kana?: string
          meaning_ko?: string
          note?: string | null
          pronunciation_ko?: string | null
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      word_learning_state: {
        Row: {
          card: Json
          due_at: string
          last_answer_id: string
          last_result: string
          last_review_at: string
          model_version: string
          personal_word_id: string | null
          question_type: string
          source: string
          updated_at: string
          user_id: string
          word_id: string | null
          word_ref: string
        }
        Insert: {
          card: Json
          due_at: string
          last_answer_id: string
          last_result: string
          last_review_at: string
          model_version: string
          personal_word_id?: string | null
          question_type: string
          source?: string
          updated_at?: string
          user_id?: string
          word_id?: string | null
          word_ref?: string
        }
        Update: {
          card?: Json
          due_at?: string
          last_answer_id?: string
          last_result?: string
          last_review_at?: string
          model_version?: string
          personal_word_id?: string | null
          question_type?: string
          source?: string
          updated_at?: string
          user_id?: string
          word_id?: string | null
          word_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_learning_state_user_id_personal_word_id_fkey"
            columns: ["user_id", "personal_word_id"]
            isOneToOne: false
            referencedRelation: "personal_word"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "word_learning_state_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "word"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      word_recent_stat: {
        Row: {
          accuracy: number | null
          attempt_count: number | null
          average_correct_response_ms: number | null
          correct_count: number | null
          last_answered_at: string | null
          user_id: string | null
          word_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      sync_manifest: { Args: never; Returns: Json }
      sync_pull: { Args: { p_versions?: Json }; Returns: Json }
      commit_learning: {
        Args: {
          expected_revision: number
          learner: Json
          processed_ids: string[]
          states: Json
        }
        Returns: boolean
      }
      game_bootstrap: { Args: never; Returns: Json }
      game_catalog_sync: {
        Args: { personal?: boolean; since?: string }
        Returns: Json
      }
      game_meaning_bank: { Args: { difficulties: number[] }; Returns: Json }
      game_sync: { Args: { since?: string }; Returns: Json }
      learning_dashboard: { Args: { p_timezone?: string }; Returns: Json }
      learning_history: { Args: { pending_only?: boolean }; Returns: Json }
      learning_snapshot: { Args: never; Returns: Json }
      notebook_page: { Args: never; Returns: Json }
      open_study_chest: { Args: { p_id: string }; Returns: Json }
      personal_game_bootstrap: { Args: never; Returns: Json }
      personal_word_list: {
        Args: { p_page?: number; p_query?: string }
        Returns: Json
      }
      personal_word_page: {
        Args: {
          p_page?: number
          p_query?: string
          p_sort?: string
          p_stage?: string
        }
        Returns: Json
      }
      recent_mistake_word: {
        Args: never
        Returns: {
          difficulty: number
          hanja_reading: string
          id: string
          kana: string
          last_incorrect_at: string
          meaning_ko: string
          note: string
          source: string
          term: string
        }[]
      }
      treasure_inventory: { Args: never; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
