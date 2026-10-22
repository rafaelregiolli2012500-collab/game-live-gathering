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
      extension_activity: {
        Row: {
          created_at: string
          game_id: string
          id: number
          kind: string
          ok: boolean
          text: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: number
          kind: string
          ok?: boolean
          text: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: number
          kind?: string
          ok?: boolean
          text?: string
        }
        Relationships: []
      }
      extension_settings: {
        Row: {
          default_character: string
          id: string
          keyword_flavio: string
          keyword_lula: string
          last_seen_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          default_character?: string
          id: string
          keyword_flavio?: string
          keyword_lula?: string
          last_seen_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          default_character?: string
          id?: string
          keyword_flavio?: string
          keyword_lula?: string
          last_seen_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_images: {
        Row: {
          game_id: string
          gift_id: string | null
          guess: string | null
          image_key: string
          image_url: string | null
          preview: string | null
          source: string
          updated_at: string
        }
        Insert: {
          game_id: string
          gift_id?: string | null
          guess?: string | null
          image_key: string
          image_url?: string | null
          preview?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          game_id?: string
          gift_id?: string | null
          guess?: string | null
          image_key?: string
          image_url?: string | null
          preview?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_config: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_events: {
        Row: {
          created_at: string
          data: Json
          event_id: string
          game_id: string
          id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          data: Json
          event_id: string
          game_id: string
          id?: string
          sequence?: never
        }
        Update: {
          created_at?: string
          data?: Json
          event_id?: string
          game_id?: string
          id?: string
          sequence?: never
        }
        Relationships: []
      }
      round_results: {
        Row: {
          contributors: Json
          created_at: string
          game_id: string
          gifts_count: number
          id: string
          loser: string
          round: number
          session_id: string
          winner: string
        }
        Insert: {
          contributors?: Json
          created_at?: string
          game_id?: string
          gifts_count?: number
          id?: string
          loser: string
          round: number
          session_id: string
          winner: string
        }
        Update: {
          contributors?: Json
          created_at?: string
          game_id?: string
          gifts_count?: number
          id?: string
          loser?: string
          round?: number
          session_id?: string
          winner?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          character: string
          created_at: string
          difficulty: string
          id: string
          mode: string
          player_name: string
          score: number
        }
        Insert: {
          character: string
          created_at?: string
          difficulty: string
          id?: string
          mode: string
          player_name: string
          score: number
        }
        Update: {
          character?: string
          created_at?: string
          difficulty?: string
          id?: string
          mode?: string
          player_name?: string
          score?: number
        }
        Relationships: []
      }
      viewer_teams: {
        Row: {
          character: string
          game_id: string
          id: string
          source_text: string | null
          updated_at: string
          username: string
        }
        Insert: {
          character: string
          game_id?: string
          id?: string
          source_text?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          character?: string
          game_id?: string
          id?: string
          source_text?: string | null
          updated_at?: string
          username?: string
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
