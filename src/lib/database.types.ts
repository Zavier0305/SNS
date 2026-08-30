export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      sns_banned_words: {
        Row: { word: string }
        Insert: { word: string }
        Update: { word?: string }
        Relationships: []
      }
      sns_blocks: {
        Row: { blocked_user_id: string; created_at: string; user_id: string }
        Insert: { blocked_user_id: string; created_at?: string; user_id: string }
        Update: { blocked_user_id?: string; created_at?: string; user_id?: string }
        Relationships: []
      }
      sns_bookmarks: {
        Row: { created_at: string; post_id: string; user_id: string }
        Insert: { created_at?: string; post_id: string; user_id: string }
        Update: { created_at?: string; post_id?: string; user_id?: string }
        Relationships: []
      }
      sns_comment_likes: {
        Row: { comment_id: string; created_at: string; user_id: string }
        Insert: { comment_id: string; created_at?: string; user_id: string }
        Update: { comment_id?: string; created_at?: string; user_id?: string }
        Relationships: []
      }
      sns_channels: {
        Row: { created_at: string; id: string; name: string; server_id: string }
        Insert: { created_at?: string; id?: string; name: string; server_id: string }
        Update: { created_at?: string; id?: string; name?: string; server_id?: string }
        Relationships: []
      }
      sns_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sns_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "sns_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sns_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sns_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_follows: {
        Row: { created_at: string; followee_id: string; follower_id: string }
        Insert: { created_at?: string; followee_id: string; follower_id: string }
        Update: { created_at?: string; followee_id?: string; follower_id?: string }
        Relationships: []
      }
      sns_likes: {
        Row: { created_at: string; post_id: string; user_id: string }
        Insert: { created_at?: string; post_id: string; user_id: string }
        Update: { created_at?: string; post_id?: string; user_id?: string }
        Relationships: []
      }
      sns_mutes: {
        Row: { created_at: string; muted_user_id: string; user_id: string }
        Insert: { created_at?: string; muted_user_id: string; user_id: string }
        Update: { created_at?: string; muted_user_id?: string; user_id?: string }
        Relationships: []
      }
      sns_poll_votes: {
        Row: {
          created_at: string
          option_index: number
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_index: number
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_index?: number
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sns_post_hashtags: {
        Row: { post_id: string; tag: string }
        Insert: { post_id: string; tag: string }
        Update: { post_id?: string; tag?: string }
        Relationships: []
      }
      sns_posts: {
        Row: {
          author_id: string
          channel_id: string | null
          content: string
          created_at: string
          expire_at: string
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_hidden: boolean
          is_pinned: boolean
          is_preserved: boolean
          poll_options: Json | null
          quoted_post_id: string | null
        }
        Insert: {
          author_id: string
          channel_id?: string | null
          content: string
          created_at?: string
          expire_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_hidden?: boolean
          is_pinned?: boolean
          is_preserved?: boolean
          poll_options?: Json | null
          quoted_post_id?: string | null
        }
        Update: {
          author_id?: string
          channel_id?: string | null
          content?: string
          created_at?: string
          expire_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_hidden?: boolean
          is_pinned?: boolean
          is_preserved?: boolean
          poll_options?: Json | null
          quoted_post_id?: string | null
        }
        Relationships: []
      }
      sns_notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sns_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "sns_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_reactions: {
        Row: { created_at: string; emoji: string; post_id: string; user_id: string }
        Insert: { created_at?: string; emoji: string; post_id: string; user_id: string }
        Update: { created_at?: string; emoji?: string; post_id?: string; user_id?: string }
        Relationships: []
      }
      sns_profiles: {
        Row: {
          created_at: string
          display_name: string
          handle: string
          id: string
          notify_comments: boolean
          notify_follows: boolean
          notify_likes: boolean
          theme_color: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          handle: string
          id: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_likes?: boolean
          theme_color?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_likes?: boolean
          theme_color?: string | null
        }
        Relationships: []
      }
      sns_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reporter_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reporter_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
        }
        Relationships: []
      }
      sns_server_join_requests: {
        Row: { created_at: string; server_id: string; user_id: string }
        Insert: { created_at?: string; server_id: string; user_id: string }
        Update: { created_at?: string; server_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "sns_server_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sns_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_server_members: {
        Row: { joined_at: string; role: string; server_id: string; user_id: string }
        Insert: { joined_at?: string; role?: string; server_id: string; user_id: string }
        Update: { joined_at?: string; role?: string; server_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "sns_server_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sns_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_servers: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          owner_id: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          topic?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sns_feed: {
        Row: {
          author_display_name: string | null
          author_handle: string | null
          author_id: string | null
          channel_id: string | null
          comment_count: number | null
          content: string | null
          created_at: string | null
          expire_at: string | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          is_hidden: boolean | null
          is_pinned: boolean | null
          is_preserved: boolean | null
          like_count: number | null
          poll_options: Json | null
          quoted_author_display_name: string | null
          quoted_author_handle: string | null
          quoted_content: string | null
          quoted_post_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sns_posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "sns_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_trending_tags: {
        Row: { post_count: number | null; tag: string | null }
        Relationships: []
      }
    }
    Functions: {
      sns_apply_decay: { Args: never; Returns: undefined }
      sns_approve_join_request: {
        Args: { p_server_id: string; p_user_id: string }
        Returns: undefined
      }
      sns_join_server: { Args: { p_server_id: string }; Returns: undefined }
      sns_kick_member: {
        Args: { p_server_id: string; p_user_id: string }
        Returns: undefined
      }
      sns_leave_server: { Args: { p_server_id: string }; Returns: undefined }
      sns_reject_join_request: {
        Args: { p_server_id: string; p_user_id: string }
        Returns: undefined
      }
      sns_set_member_role: {
        Args: { p_role: string; p_server_id: string; p_user_id: string }
        Returns: undefined
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
