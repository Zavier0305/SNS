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
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      sns_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sns_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          expire_at: string
          id: string
          image_url: string | null
          is_hidden: boolean
          is_preserved: boolean
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          expire_at?: string
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_preserved?: boolean
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          expire_at?: string
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_preserved?: boolean
        }
        Relationships: []
      }
      sns_profiles: {
        Row: {
          created_at: string
          display_name: string
          handle: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          handle: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
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
          comment_count: number | null
          content: string | null
          created_at: string | null
          expire_at: string | null
          id: string | null
          image_url: string | null
          is_hidden: boolean | null
          is_preserved: boolean | null
          like_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      sns_apply_decay: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
