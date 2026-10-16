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
      banned_identifiers: {
        Row: {
          created_at: string
          kind: string
          source_user: string | null
          value: string
        }
        Insert: {
          created_at?: string
          kind: string
          source_user?: string | null
          value: string
        }
        Update: {
          created_at?: string
          kind?: string
          source_user?: string | null
          value?: string
        }
        Relationships: []
      }
      bans: {
        Row: {
          banned_by: string | null
          created_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: { blocker_id: string; blocked_id: string; created_at: string }
        Insert: { blocker_id: string; blocked_id: string; created_at?: string }
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      dm_conversations: {
        Row: { id: string; user_a: string; user_b: string; created_at: string }
        Insert: { id?: string; user_a: string; user_b: string; created_at?: string }
        Update: { id?: string; user_a?: string; user_b?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "dm_conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          created_at: string
          edited_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          created_at?: string
          edited_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_polls: {
        Row: { id: string; author_id: string; question: string; options: string[]; ends_at: string | null; created_at: string }
        Insert: { id?: string; author_id: string; question: string; options: string[]; ends_at?: string | null; created_at?: string }
        Update: { id?: string; author_id?: string; question?: string; options?: string[]; ends_at?: string | null; created_at?: string }
        Relationships: []
      }
      community_poll_votes: {
        Row: { poll_id: string; user_id: string; option_index: number; created_at: string }
        Insert: { poll_id: string; user_id: string; option_index: number; created_at?: string }
        Update: { poll_id?: string; user_id?: string; option_index?: number; created_at?: string }
        Relationships: []
      }
      community_suggestions: {
        Row: { id: string; author_id: string; title: string; description: string; status: string; response: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; author_id: string; title: string; description: string; status?: string; response?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; author_id?: string; title?: string; description?: string; status?: string; response?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      community_suggestion_votes: {
        Row: { suggestion_id: string; user_id: string; created_at: string }
        Insert: { suggestion_id: string; user_id: string; created_at?: string }
        Update: { suggestion_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      community_reports: {
        Row: { id: string; reporter_id: string; target_user_id: string | null; target_message_id: string | null; reason: string; status: string; moderator_note: string | null; created_at: string; resolved_at: string | null }
        Insert: { id?: string; reporter_id: string; target_user_id?: string | null; target_message_id?: string | null; reason: string; status?: string; moderator_note?: string | null; created_at?: string; resolved_at?: string | null }
        Update: { id?: string; reporter_id?: string; target_user_id?: string | null; target_message_id?: string | null; reason?: string; status?: string; moderator_note?: string | null; created_at?: string; resolved_at?: string | null }
        Relationships: []
      }
      community_events: {
        Row: { id: string; author_id: string; title: string; description: string; starts_at: string; location: string | null; status: string; created_at: string }
        Insert: { id?: string; author_id: string; title: string; description: string; starts_at: string; location?: string | null; status?: string; created_at?: string }
        Update: { id?: string; author_id?: string; title?: string; description?: string; starts_at?: string; location?: string | null; status?: string; created_at?: string }
        Relationships: []
      }
      community_event_rsvps: {
        Row: { event_id: string; user_id: string; created_at: string }
        Insert: { event_id: string; user_id: string; created_at?: string }
        Update: { event_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      admin_audit_log: {
        Row: { id: string; actor_id: string; action: string; target_user_id: string | null; details: Json; created_at: string }
        Insert: { id?: string; actor_id: string; action: string; target_user_id?: string | null; details?: Json; created_at?: string }
        Update: { id?: string; actor_id?: string; action?: string; target_user_id?: string | null; details?: Json; created_at?: string }
        Relationships: []
      }
      message_reactions: {
        Row: { message_id: string; user_id: string; reaction: string; created_at: string }
        Insert: { message_id: string; user_id: string; reaction: string; created_at?: string }
        Update: { message_id?: string; user_id?: string; reaction?: string; created_at?: string }
        Relationships: []
      }
      user_notifications: {
        Row: {
          id: string
          user_id: string
          actor_id: string | null
          kind: string
          title: string
          body: string
          channel_id: string | null
          message_id: string | null
          conversation_id: string | null
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          actor_id?: string | null
          kind: string
          title: string
          body?: string
          channel_id?: string | null
          message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          actor_id?: string | null
          kind?: string
          title?: string
          body?: string
          channel_id?: string | null
          message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          reply_to: string | null
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_color: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          custom_status: string | null
          display_name: string | null
          id: string
          pronouns: string | null
          profile_extras: Json
          status: string
          theme_accent: string | null
          theme_primary: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_status?: string | null
          display_name?: string | null
          id: string
          pronouns?: string | null
          profile_extras?: Json
          status?: string
          theme_accent?: string | null
          theme_primary?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_status?: string | null
          display_name?: string | null
          id?: string
          pronouns?: string | null
          profile_extras?: Json
          status?: string
          theme_accent?: string | null
          theme_primary?: string | null
          username?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          user_a: string
          user_b: string
          requested_by: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_a: string
          user_b: string
          requested_by: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_a?: string
          user_b?: string
          requested_by?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeouts: {
        Row: {
          created_at: string
          created_by: string | null
          until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          until: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          until?: string
          user_id?: string
        }
        Relationships: []
      }
      user_identifiers: {
        Row: {
          kind: string
          last_seen: string
          user_id: string
          value: string
        }
        Insert: {
          kind: string
          last_seen?: string
          user_id: string
          value: string
        }
        Update: {
          kind?: string
          last_seen?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      admin_set_role: { Args: { _actor: string; _target: string; _enabled: boolean }; Returns: undefined }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      is_timed_out: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
