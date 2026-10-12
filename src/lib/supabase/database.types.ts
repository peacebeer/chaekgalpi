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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      book_chapters: {
        Row: {
          book_id: string
          number: number
          start_page: number | null
          title: string
        }
        Insert: {
          book_id: string
          number: number
          start_page?: number | null
          title: string
        }
        Update: {
          book_id?: string
          number?: number
          start_page?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          created_at: string
          created_by: string | null
          id: string
          isbn: string | null
          pages: number | null
          publisher: string | null
          source: string
          title: string
          translator: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          isbn?: string | null
          pages?: number | null
          publisher?: string | null
          source?: string
          title: string
          translator?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          isbn?: string | null
          pages?: number | null
          publisher?: string | null
          source?: string
          title?: string
          translator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          book_id: string
          capacity: number
          created_at: string
          id: string
          invite_code: string
          is_public: boolean
          name: string
          owner_id: string | null
          quote_limit: number
          start_date: string | null
          target_date: string | null
        }
        Insert: {
          book_id: string
          capacity?: number
          created_at?: string
          id?: string
          invite_code?: string
          is_public?: boolean
          name: string
          owner_id?: string | null
          quote_limit?: number
          start_date?: string | null
          target_date?: string | null
        }
        Update: {
          book_id?: string
          capacity?: number
          created_at?: string
          id?: string
          invite_code?: string
          is_public?: boolean
          name?: string
          owner_id?: string | null
          quote_limit?: number
          start_date?: string | null
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          finished_at: string | null
          group_id: string
          joined_at: string
          progress_chapter: number
          progress_pct: number
          role: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          group_id: string
          joined_at?: string
          progress_chapter?: number
          progress_pct?: number
          role?: string
          user_id: string
        }
        Update: {
          finished_at?: string | null
          group_id?: string
          joined_at?: string
          progress_chapter?: number
          progress_pct?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          chapter: number | null
          created_at: string
          group_id: string
          hidden_at: string | null
          id: string
          kind: string
          parent_id: string | null
          pct: number | null
          quote_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          chapter?: number | null
          created_at?: string
          group_id: string
          hidden_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          pct?: number | null
          quote_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          chapter?: number | null
          created_at?: string
          group_id?: string
          hidden_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          pct?: number | null
          quote_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string
          region: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nickname: string
          region?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          region?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          chapter: number
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          locked_at: string | null
          pct: number
          text: string
          updated_at: string
        }
        Insert: {
          chapter: number
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          locked_at?: string | null
          pct?: number
          text: string
          updated_at?: string
        }
        Update: {
          chapter?: number
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          locked_at?: string | null
          pct?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see: {
        Args: { p_chapter: number; p_group_id: string; p_pct: number }
        Returns: boolean
      }
      changed_span: { Args: { p_new: string; p_old: string }; Returns: number }
      chapter_in_use: {
        Args: { p_book_id: string; p_number: number }
        Returns: boolean
      }
      create_quote: {
        Args: {
          p_body: string
          p_chapter: number
          p_group_id: string
          p_kind?: string
          p_pct: number
          p_text: string
        }
        Returns: string
      }
      hide_note: {
        Args: { p_hidden?: boolean; p_note_id: string }
        Returns: undefined
      }
      is_member: { Args: { p_group_id: string }; Returns: boolean }
      is_owner: { Args: { p_group_id: string }; Returns: boolean }
      join_group: {
        Args: { p_group_id?: string; p_invite_code?: string }
        Returns: string
      }
      locked_counts: {
        Args: { p_group_id: string }
        Returns: {
          chapter: number
          notes: number
          quotes: number
        }[]
      }
      page_to_position: {
        Args: { p_book_id: string; p_page: number }
        Returns: {
          chapter: number
          pct: number
        }[]
      }
      shares_group: { Args: { p_user_id: string }; Returns: boolean }
      similar_quotes: {
        Args: {
          p_chapter: number
          p_group_id: string
          p_pct: number
          p_text: string
        }
        Returns: {
          chapter: number
          id: string
          pct: number
          score: number
          text: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
