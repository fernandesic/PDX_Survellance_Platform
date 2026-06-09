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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          confidence_score: number | null
          created_at: string
          id: string
          multi_source_validated: boolean | null
          record_id: string | null
          risk_level: string | null
          signal_strength: number | null
          trigger_reason: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          multi_source_validated?: boolean | null
          record_id?: string | null
          risk_level?: string | null
          signal_strength?: number | null
          trigger_reason: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          multi_source_validated?: boolean | null
          record_id?: string | null
          risk_level?: string | null
          signal_strength?: number | null
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "processed_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      briefings: {
        Row: {
          briefing_type: string
          content: Json | null
          country_filter: string[] | null
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          briefing_type?: string
          content?: Json | null
          country_filter?: string[] | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          briefing_type?: string
          content?: Json | null
          country_filter?: string[] | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          aliases: string[] | null
          country_code: string | null
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          aliases?: string[] | null
          country_code?: string | null
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          aliases?: string[] | null
          country_code?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      evidence_spans: {
        Row: {
          end_char: number | null
          field_name: string
          id: string
          record_id: string | null
          sentence_text: string
          source_url: string | null
          start_char: number | null
        }
        Insert: {
          end_char?: number | null
          field_name: string
          id?: string
          record_id?: string | null
          sentence_text: string
          source_url?: string | null
          start_char?: number | null
        }
        Update: {
          end_char?: number | null
          field_name?: string
          id?: string
          record_id?: string | null
          sentence_text?: string
          source_url?: string | null
          start_char?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_spans_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "processed_records"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_records: {
        Row: {
          actors: Json | null
          citations: Json | null
          country_tags: string[] | null
          created_at: string
          event_type: string | null
          extracted_text: string | null
          headline: string
          id: string
          impact_assessment: string | null
          language: string | null
          publish_time: string | null
          raw_item_id: string | null
          recommended_posture: string | null
          region_tags: string[] | null
          risk_level: string | null
          scs_tier: number | null
          signal_strength: number | null
          source_url: string | null
          stance: string | null
          status: string | null
          topics: string[] | null
          updated_at: string
        }
        Insert: {
          actors?: Json | null
          citations?: Json | null
          country_tags?: string[] | null
          created_at?: string
          event_type?: string | null
          extracted_text?: string | null
          headline: string
          id?: string
          impact_assessment?: string | null
          language?: string | null
          publish_time?: string | null
          raw_item_id?: string | null
          recommended_posture?: string | null
          region_tags?: string[] | null
          risk_level?: string | null
          scs_tier?: number | null
          signal_strength?: number | null
          source_url?: string | null
          stance?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string
        }
        Update: {
          actors?: Json | null
          citations?: Json | null
          country_tags?: string[] | null
          created_at?: string
          event_type?: string | null
          extracted_text?: string | null
          headline?: string
          id?: string
          impact_assessment?: string | null
          language?: string | null
          publish_time?: string | null
          raw_item_id?: string | null
          recommended_posture?: string | null
          region_tags?: string[] | null
          risk_level?: string | null
          scs_tier?: number | null
          signal_strength?: number | null
          source_url?: string | null
          stance?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_records_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_items: {
        Row: {
          body_raw: string | null
          dedup_hash: string | null
          failure_log: string | null
          id: string
          ingested_at: string
          is_duplicate: boolean | null
          language_detected: string | null
          published_at: string | null
          source_id: string | null
          title: string | null
          url: string | null
          url_canonical: string | null
          version: number
        }
        Insert: {
          body_raw?: string | null
          dedup_hash?: string | null
          failure_log?: string | null
          id?: string
          ingested_at?: string
          is_duplicate?: boolean | null
          language_detected?: string | null
          published_at?: string | null
          source_id?: string | null
          title?: string | null
          url?: string | null
          url_canonical?: string | null
          version?: number
        }
        Update: {
          body_raw?: string | null
          dedup_hash?: string | null
          failure_log?: string | null
          id?: string
          ingested_at?: string
          is_duplicate?: boolean | null
          language_detected?: string | null
          published_at?: string | null
          source_id?: string | null
          title?: string | null
          url?: string | null
          url_canonical?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "raw_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          language: string | null
          last_fetched_at: string | null
          name: string
          scs_numeric: number | null
          tier: string
          url: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          name: string
          scs_numeric?: number | null
          tier?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          name?: string
          scs_numeric?: number | null
          tier?: string
          url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "viewer" | "analyst" | "leader" | "admin"
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
    Enums: {
      app_role: ["viewer", "analyst", "leader", "admin"],
    },
  },
} as const
