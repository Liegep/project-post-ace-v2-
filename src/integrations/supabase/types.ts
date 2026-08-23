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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          item_id: string | null
          item_title: string
          item_type: string
          metadata: Json | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_title?: string
          item_type: string
          metadata?: Json | null
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_title?: string
          item_type?: string
          metadata?: Json | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invitations: {
        Row: {
          accepted_at: string | null
          client_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          client_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          actor_avatar_url: string
          client_id: string | null
          created_at: string
          id: string
          message: string
          post_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          actor_avatar_url?: string
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string
          post_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Update: {
          actor_avatar_url?: string
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string
          post_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          template_text: string
          updated_at: string
          variables: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          template_text?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          template_text?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointment_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          cancelled: boolean
          cancelled_at: string | null
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string
          id: string
          legacy_event_id: string | null
          legacy_source: string | null
          tag_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time?: string
          cancelled?: boolean
          cancelled_at?: string | null
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          legacy_event_id?: string | null
          legacy_source?: string | null
          tag_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          cancelled?: boolean
          cancelled_at?: string | null
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          legacy_event_id?: string | null
          legacy_source?: string | null
          tag_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "appointment_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          action: string
          actor_name: string
          comment: string
          created_at: string
          id: string
          post_id: string
          token_id: string
        }
        Insert: {
          action: string
          actor_name?: string
          comment?: string
          created_at?: string
          id?: string
          post_id: string
          token_id: string
        }
        Update: {
          action?: string
          actor_name?: string
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "approval_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tokens: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          post_id: string | null
          token: string
          token_type: string
          used_at: string | null
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          post_id?: string | null
          token: string
          token_type?: string
          used_at?: string | null
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          post_id?: string | null
          token?: string
          token_type?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tokens_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_expressions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          emotion: string
          expression: string
          id: string
          notes: string
          updated_at: string
          usage_context: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          emotion?: string
          expression: string
          id?: string
          notes?: string
          updated_at?: string
          usage_context?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          emotion?: string
          expression?: string
          id?: string
          notes?: string
          updated_at?: string
          usage_context?: string
        }
        Relationships: []
      }
      billing_access_logs: {
        Row: {
          action: string
          client_id: string
          created_at: string
          document_id: string | null
          document_name: string
          document_type: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          client_id: string
          created_at?: string
          document_id?: string | null
          document_name?: string
          document_type: string
          id?: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          document_id?: string | null
          document_name?: string
          document_type?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_access_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_brains: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mission: string
          summary: string
          updated_at: string
          updated_by: string | null
          vision: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mission?: string
          summary?: string
          updated_at?: string
          updated_by?: string | null
          vision?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mission?: string
          summary?: string
          updated_at?: string
          updated_by?: string | null
          vision?: string
        }
        Relationships: []
      }
      brand_vocabulary: {
        Row: {
          approved_phrases: string[]
          brand: string
          can_be_used: boolean
          category: string
          client_id: string
          content_type: string
          created_at: string
          created_by: string | null
          emotion: string
          frequency: string
          id: string
          notes: string
          priority: string
          related_words: string[]
          status: string
          technical_notes: string
          term: string
          updated_at: string
        }
        Insert: {
          approved_phrases?: string[]
          brand?: string
          can_be_used?: boolean
          category?: string
          client_id: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          emotion?: string
          frequency?: string
          id?: string
          notes?: string
          priority?: string
          related_words?: string[]
          status?: string
          technical_notes?: string
          term: string
          updated_at?: string
        }
        Update: {
          approved_phrases?: string[]
          brand?: string
          can_be_used?: boolean
          category?: string
          client_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          emotion?: string
          frequency?: string
          id?: string
          notes?: string
          priority?: string
          related_words?: string[]
          status?: string
          technical_notes?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_voice: {
        Row: {
          archetype: string
          bad_examples: string[]
          brand_name: string
          client_id: string
          created_at: string
          emotional_tone: string
          formality_level: string
          good_examples: string[]
          id: string
          things_to_avoid: string
          updated_at: string
          updated_by: string | null
          writing_rhythm: string
        }
        Insert: {
          archetype?: string
          bad_examples?: string[]
          brand_name?: string
          client_id: string
          created_at?: string
          emotional_tone?: string
          formality_level?: string
          good_examples?: string[]
          id?: string
          things_to_avoid?: string
          updated_at?: string
          updated_by?: string | null
          writing_rhythm?: string
        }
        Update: {
          archetype?: string
          bad_examples?: string[]
          brand_name?: string
          client_id?: string
          created_at?: string
          emotional_tone?: string
          formality_level?: string
          good_examples?: string[]
          id?: string
          things_to_avoid?: string
          updated_at?: string
          updated_by?: string | null
          writing_rhythm?: string
        }
        Relationships: []
      }
      brief_assignments: {
        Row: {
          assigned_by: string
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          status: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          template_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "brief_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_attachments: {
        Row: {
          brief_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          brief_id: string
          created_at?: string
          file_name?: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          brief_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_attachments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_comments: {
        Row: {
          author_name: string
          author_role: string
          brief_id: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          author_name?: string
          author_role?: string
          brief_id: string
          created_at?: string
          id?: string
          message?: string
          user_id: string
        }
        Update: {
          author_name?: string
          author_role?: string
          brief_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_comments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_responses: {
        Row: {
          answers: Json
          assignment_id: string
          client_id: string
          created_at: string
          id: string
          submitted_at: string | null
          submitted_by: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          assignment_id: string
          client_id: string
          created_at?: string
          id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          assignment_id?: string
          client_id?: string
          created_at?: string
          id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "brief_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "brief_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_templates: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          locale: string
          name: string
          questions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          locale?: string
          name?: string
          questions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          locale?: string
          name?: string
          questions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_posts: {
        Row: {
          caption: string
          client_id: string
          created_at: string
          created_by: string | null
          event_color: string | null
          id: string
          media_type: string
          media_urls: string[]
          publish_date: string
          publish_time: string
          status: Database["public"]["Enums"]["calendar_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          event_color?: string | null
          id?: string
          media_type?: string
          media_urls?: string[]
          publish_date: string
          publish_time?: string
          status?: Database["public"]["Enums"]["calendar_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          event_color?: string | null
          id?: string
          media_type?: string
          media_urls?: string[]
          publish_date?: string
          publish_time?: string
          status?: Database["public"]["Enums"]["calendar_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_billing_permissions: {
        Row: {
          can_download_attachments: boolean
          can_download_invoices: boolean
          can_view_attachments: boolean
          can_view_invoices: boolean
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_download_attachments?: boolean
          can_download_invoices?: boolean
          can_view_attachments?: boolean
          can_view_invoices?: boolean
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_download_attachments?: boolean
          can_download_invoices?: boolean
          can_view_attachments?: boolean
          can_view_invoices?: boolean
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_permissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_links: {
        Row: {
          client_id: string
          created_at: string
          id: string
          position: number
          section_title: string
          title: string
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          position?: number
          section_title?: string
          title?: string
          url?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          position?: number
          section_title?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          attachments: Json
          client_id: string
          color: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          client_id: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          client_id?: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pauta_ideas: {
        Row: {
          caption: string
          client_id: string
          comment: string
          converted_at: string | null
          converted_post_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_urls: string[]
          internal_comment: string
          reference_link: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string
          client_id: string
          comment?: string
          converted_at?: string | null
          converted_post_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_urls?: string[]
          internal_comment?: string
          reference_link?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string
          client_id?: string
          comment?: string
          converted_at?: string | null
          converted_post_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_urls?: string[]
          internal_comment?: string
          reference_link?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pauta_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pauta_ideas_converted_post_id_fkey"
            columns: ["converted_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_seen_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string
          allow_client_create_post: boolean
          allow_client_create_tags: boolean
          allow_client_download: boolean
          allow_client_edit_brand_brain: boolean
          allow_client_edit_caption: boolean
          allow_quick_access: boolean
          billing_currency: string
          billing_description: string
          billing_due_day: number
          billing_monthly_amount: number
          billing_recurrence_active: boolean
          billing_start_date: string | null
          billing_type: string
          calendar_color: string | null
          calendar_legend: Json
          client_portal_title: string
          client_type: string
          country: string
          created_at: string
          facebook_url: string
          id: string
          instagram_url: string
          link_expiration_days: number
          linkedin_url: string
          locale: string
          logo_url: string
          name: string
          owner_id: string | null
          posting_period: string
          require_login: boolean
          shared: boolean
          show_archived_to_client: boolean
          show_invoices_to_client: boolean
          show_upcoming_posts: boolean
          slug: string
          tax_id: string
          tiktok_url: string
          tracking_column_ids: string[]
          tracking_enabled: boolean
          tracking_visible_to_client: boolean
          trello_board_id: string
          twitter_url: string
          updated_at: string
          website_url: string
          youtube_url: string
        }
        Insert: {
          address?: string
          allow_client_create_post?: boolean
          allow_client_create_tags?: boolean
          allow_client_download?: boolean
          allow_client_edit_brand_brain?: boolean
          allow_client_edit_caption?: boolean
          allow_quick_access?: boolean
          billing_currency?: string
          billing_description?: string
          billing_due_day?: number
          billing_monthly_amount?: number
          billing_recurrence_active?: boolean
          billing_start_date?: string | null
          billing_type?: string
          calendar_color?: string | null
          calendar_legend?: Json
          client_portal_title?: string
          client_type?: string
          country?: string
          created_at?: string
          facebook_url?: string
          id?: string
          instagram_url?: string
          link_expiration_days?: number
          linkedin_url?: string
          locale?: string
          logo_url?: string
          name: string
          owner_id?: string | null
          posting_period?: string
          require_login?: boolean
          shared?: boolean
          show_archived_to_client?: boolean
          show_invoices_to_client?: boolean
          show_upcoming_posts?: boolean
          slug: string
          tax_id?: string
          tiktok_url?: string
          tracking_column_ids?: string[]
          tracking_enabled?: boolean
          tracking_visible_to_client?: boolean
          trello_board_id?: string
          twitter_url?: string
          updated_at?: string
          website_url?: string
          youtube_url?: string
        }
        Update: {
          address?: string
          allow_client_create_post?: boolean
          allow_client_create_tags?: boolean
          allow_client_download?: boolean
          allow_client_edit_brand_brain?: boolean
          allow_client_edit_caption?: boolean
          allow_quick_access?: boolean
          billing_currency?: string
          billing_description?: string
          billing_due_day?: number
          billing_monthly_amount?: number
          billing_recurrence_active?: boolean
          billing_start_date?: string | null
          billing_type?: string
          calendar_color?: string | null
          calendar_legend?: Json
          client_portal_title?: string
          client_type?: string
          country?: string
          created_at?: string
          facebook_url?: string
          id?: string
          instagram_url?: string
          link_expiration_days?: number
          linkedin_url?: string
          locale?: string
          logo_url?: string
          name?: string
          owner_id?: string | null
          posting_period?: string
          require_login?: boolean
          shared?: boolean
          show_archived_to_client?: boolean
          show_invoices_to_client?: boolean
          show_upcoming_posts?: boolean
          slug?: string
          tax_id?: string
          tiktok_url?: string
          tracking_column_ids?: string[]
          tracking_enabled?: boolean
          tracking_visible_to_client?: boolean
          trello_board_id?: string
          twitter_url?: string
          updated_at?: string
          website_url?: string
          youtube_url?: string
        }
        Relationships: []
      }
      columns: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          trello_list_id: string | null
          visible_to_client: boolean
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          trello_list_id?: string | null
          visible_to_client?: boolean
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          trello_list_id?: string | null
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "columns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      commemorative_dates: {
        Row: {
          category: string
          country: string
          country_code: string
          country_color: string
          created_at: string
          date_day: number
          date_month: number
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          country: string
          country_code?: string
          country_color?: string
          created_at?: string
          date_day: number
          date_month: number
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          country?: string
          country_code?: string
          country_color?: string
          created_at?: string
          date_day?: number
          date_month?: number
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author: string
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string | null
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          post_id: string
          text: string
          user_id?: string | null
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_briefs: {
        Row: {
          assigned_to: string | null
          caption: string
          client_id: string
          content_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          internal_notes: string
          media_urls: string[]
          planned_date: string | null
          status: Database["public"]["Enums"]["brief_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          caption?: string
          client_id: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          internal_notes?: string
          media_urls?: string[]
          planned_date?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          caption?: string
          client_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          internal_notes?: string
          media_urls?: string[]
          planned_date?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          main_emotion: string
          name: string
          notes: string
          objective: string
          suggested_frequency: string
          themes: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          main_emotion?: string
          name: string
          notes?: string
          objective?: string
          suggested_frequency?: string
          themes?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          main_emotion?: string
          name?: string
          notes?: string
          objective?: string
          suggested_frequency?: string
          themes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      contract_acceptances: {
        Row: {
          accepted_at: string
          contract_id: string
          id: string
          ip_address: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          contract_id: string
          id?: string
          ip_address?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          contract_id?: string
          id?: string
          ip_address?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      design_brief_tokens: {
        Row: {
          active: boolean
          brief_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          active?: boolean
          brief_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Update: {
          active?: boolean
          brief_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_brief_tokens_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "design_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      design_briefs: {
        Row: {
          additional_notes: string
          answers: Json
          brand_name: string
          category: string
          client_id: string | null
          created_at: string
          id: string
          locale: string
          objectives: string
          preferred_colors: string
          references_links: string
          respondent_email: string
          respondent_name: string
          status: string
          style_preferences: string
          submitted_at: string | null
          target_audience: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string
          answers?: Json
          brand_name?: string
          category?: string
          client_id?: string | null
          created_at?: string
          id?: string
          locale?: string
          objectives?: string
          preferred_colors?: string
          references_links?: string
          respondent_email?: string
          respondent_name?: string
          status?: string
          style_preferences?: string
          submitted_at?: string | null
          target_audience?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string
          answers?: Json
          brand_name?: string
          category?: string
          client_id?: string | null
          created_at?: string
          id?: string
          locale?: string
          objectives?: string
          preferred_colors?: string
          references_links?: string
          respondent_email?: string
          respondent_name?: string
          status?: string
          style_preferences?: string
          submitted_at?: string | null
          target_audience?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_prompts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          output: string
          params: Json
          pillar_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          output?: string
          params?: Json
          pillar_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          output?: string
          params?: Json
          pillar_id?: string | null
        }
        Relationships: []
      }
      hashtag_groups: {
        Row: {
          client_id: string
          created_at: string
          hashtags: string[]
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          hashtags?: string[]
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string
          hashtags?: string[]
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtag_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_columns: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          column_id: string
          converted_at: string | null
          converted_brief_id: string | null
          converted_to_brief: boolean
          created_at: string
          description: string
          id: string
          position: number
          title: string
          user_id: string
        }
        Insert: {
          column_id: string
          converted_at?: string | null
          converted_brief_id?: string | null
          converted_to_brief?: boolean
          created_at?: string
          description?: string
          id?: string
          position?: number
          title: string
          user_id: string
        }
        Update: {
          column_id?: string
          converted_at?: string | null
          converted_brief_id?: string | null
          converted_to_brief?: boolean
          created_at?: string
          description?: string
          id?: string
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "idea_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_approvals: {
        Row: {
          assigned_to: string
          client_id: string
          comment: string
          created_at: string
          id: string
          post_id: string
          requested_by: string
          responded_at: string | null
          status: string
        }
        Insert: {
          assigned_to: string
          client_id: string
          comment?: string
          created_at?: string
          id?: string
          post_id: string
          requested_by: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string
          client_id?: string
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          requested_by?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          invoice_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          invoice_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          invoice_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_attachments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          invoice_id: string
          name: string
          notes: string
          post_id: string | null
          quantity: number
          service_date: string
          total_price: number
          unit_price: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          name?: string
          notes?: string
          post_id?: string | null
          quantity?: number
          service_date?: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          name?: string
          notes?: string
          post_id?: string | null
          quantity?: number
          service_date?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          client_visible: boolean
          created_at: string
          created_by: string | null
          discount: number
          due_date: string
          id: string
          invoice_number: number
          issue_date: string
          notes: string
          paid_at: string | null
          payment_details: string
          payment_method: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          surcharge: number
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: number
          issue_date?: string
          notes?: string
          paid_at?: string | null
          payment_details?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          surcharge?: number
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: number
          issue_date?: string
          notes?: string
          paid_at?: string | null
          payment_details?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          surcharge?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_automations: {
        Row: {
          action_type: string
          action_value: string
          active: boolean
          client_id: string
          created_at: string
          id: string
          name: string
          trigger_column_id: string | null
          trigger_type: string
          trigger_value: string
          updated_at: string
        }
        Insert: {
          action_type: string
          action_value?: string
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          name?: string
          trigger_column_id?: string | null
          trigger_type?: string
          trigger_value?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          action_value?: string
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          trigger_column_id?: string | null
          trigger_type?: string
          trigger_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_automations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_automations_trigger_column_id_fkey"
            columns: ["trigger_column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_accounts: {
        Row: {
          access_token: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          meta_user_id: string
          meta_user_name: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta_user_id: string
          meta_user_name?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta_user_id?: string
          meta_user_name?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          client_id: string
          created_at: string
          id: string
          instagram_account_id: string | null
          instagram_username: string | null
          meta_account_id: string
          page_access_token: string
          page_id: string
          page_name: string
          platform: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          meta_account_id: string
          page_access_token: string
          page_id: string
          page_name?: string
          platform?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          meta_account_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_feedback: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string
          post_id: string
          to_user_id: string | null
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string
          post_id: string
          to_user_id?: string | null
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          post_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_feedback_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          post_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          post_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_status_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tracking: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          post_id: string
          step_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          post_id: string
          step_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          post_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tracking_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tracking_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "tracking_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          archived: boolean
          archived_at: string | null
          art_type: string
          caption: string
          client_created_at: string | null
          client_id: string | null
          client_label: string
          client_unarchived_at: string | null
          column_id: string | null
          content_pillar_id: string | null
          created_at: string
          deadline: string | null
          event_color: string | null
          id: string
          image_url: string
          is_pauta: boolean
          media_type: string
          media_urls: string[]
          position: number
          published_at: string | null
          retain_files: boolean
          status: string[]
          tags: string[]
          title: string
          trello_card_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          art_type?: string
          caption?: string
          client_created_at?: string | null
          client_id?: string | null
          client_label?: string
          client_unarchived_at?: string | null
          column_id?: string | null
          content_pillar_id?: string | null
          created_at?: string
          deadline?: string | null
          event_color?: string | null
          id?: string
          image_url: string
          is_pauta?: boolean
          media_type?: string
          media_urls?: string[]
          position?: number
          published_at?: string | null
          retain_files?: boolean
          status?: string[]
          tags?: string[]
          title: string
          trello_card_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          art_type?: string
          caption?: string
          client_created_at?: string | null
          client_id?: string | null
          client_label?: string
          client_unarchived_at?: string | null
          column_id?: string | null
          content_pillar_id?: string | null
          created_at?: string
          deadline?: string | null
          event_color?: string | null
          id?: string
          image_url?: string
          is_pauta?: boolean
          media_type?: string
          media_urls?: string[]
          position?: number
          published_at?: string | null
          retain_files?: boolean
          status?: string[]
          tags?: string[]
          title?: string
          trello_card_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_content_pillar_id_fkey"
            columns: ["content_pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      proposal_templates: {
        Row: {
          created_at: string
          currency: string
          id: string
          investment_description: string
          locale: string
          name: string
          scope_description: string
          services: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          investment_description?: string
          locale?: string
          name: string
          scope_description?: string
          services?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          investment_description?: string
          locale?: string
          name?: string
          scope_description?: string
          services?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_at: string | null
          accepted_email: string
          accepted_ip: string
          accepted_name: string
          accepted_signature: string
          client_email: string
          client_name: string
          created_at: string
          currency: string
          deadline_days: number
          expires_at: string
          id: string
          investment_description: string
          locale: string
          pieces_quantity: number
          plan: string
          proposal_type: string
          scope_description: string
          services: Json
          status: Database["public"]["Enums"]["proposal_status"]
          token: string
          total_value: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_email?: string
          accepted_ip?: string
          accepted_name?: string
          accepted_signature?: string
          client_email?: string
          client_name: string
          created_at?: string
          currency?: string
          deadline_days?: number
          expires_at?: string
          id?: string
          investment_description?: string
          locale?: string
          pieces_quantity?: number
          plan?: string
          proposal_type?: string
          scope_description?: string
          services?: Json
          status?: Database["public"]["Enums"]["proposal_status"]
          token?: string
          total_value?: number
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_email?: string
          accepted_ip?: string
          accepted_name?: string
          accepted_signature?: string
          client_email?: string
          client_name?: string
          created_at?: string
          currency?: string
          deadline_days?: number
          expires_at?: string
          id?: string
          investment_description?: string
          locale?: string
          pieces_quantity?: number
          plan?: string
          proposal_type?: string
          scope_description?: string
          services?: Json
          status?: Database["public"]["Enums"]["proposal_status"]
          token?: string
          total_value?: number
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      quick_notes: {
        Row: {
          client_id: string
          color: string
          content: string
          created_at: string
          id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          social_post_id: string
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          social_post_id: string
          success?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          social_post_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "social_logs_social_post_id_fkey"
            columns: ["social_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_history: {
        Row: {
          change_note: string
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["social_post_status"]
          old_status: Database["public"]["Enums"]["social_post_status"] | null
          social_post_id: string
        }
        Insert: {
          change_note?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["social_post_status"]
          old_status?: Database["public"]["Enums"]["social_post_status"] | null
          social_post_id: string
        }
        Update: {
          change_note?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["social_post_status"]
          old_status?: Database["public"]["Enums"]["social_post_status"] | null
          social_post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_history_social_post_id_fkey"
            columns: ["social_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          caption: string
          client_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          media_type: string
          media_urls: string[]
          meta_page_id: string | null
          meta_post_id: string | null
          notes: string
          platform: string
          published_at: string | null
          retry_count: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["social_post_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          caption?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_type?: string
          media_urls?: string[]
          meta_page_id?: string | null
          meta_post_id?: string | null
          notes?: string
          platform?: string
          published_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          caption?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_type?: string
          media_urls?: string[]
          meta_page_id?: string | null
          meta_post_id?: string | null
          notes?: string
          platform?: string
          published_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric_fields: Json
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_fields?: Json
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_fields?: Json
          name?: string
        }
        Relationships: []
      }
      social_reports: {
        Row: {
          best_content: string
          best_format: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          locale: string
          metrics: Json
          observations: string
          period_end: string
          period_start: string
          platform: string
          previous_metrics: Json
          recommendations: string
          status: string
          strategic_comment: string
          template_id: string | null
          title: string
          updated_at: string
          worst_content: string
        }
        Insert: {
          best_content?: string
          best_format?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          metrics?: Json
          observations?: string
          period_end: string
          period_start: string
          platform?: string
          previous_metrics?: Json
          recommendations?: string
          status?: string
          strategic_comment?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          worst_content?: string
        }
        Update: {
          best_content?: string
          best_format?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          metrics?: Json
          observations?: string
          period_end?: string
          period_start?: string
          platform?: string
          previous_metrics?: Json
          recommendations?: string
          status?: string
          strategic_comment?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          worst_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          client_id: string | null
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id?: string | null
          color: string
          created_at?: string
          id: string
          name: string
        }
        Update: {
          client_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      text_content_comments: {
        Row: {
          author_name: string
          author_role: string
          created_at: string
          id: string
          message: string
          text_content_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          author_role?: string
          created_at?: string
          id?: string
          message?: string
          text_content_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          author_role?: string
          created_at?: string
          id?: string
          message?: string
          text_content_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_content_comments_text_content_id_fkey"
            columns: ["text_content_id"]
            isOneToOne: false
            referencedRelation: "text_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      text_contents: {
        Row: {
          body: string
          client_id: string
          client_label: string
          content_type: Database["public"]["Enums"]["text_content_type"]
          created_at: string
          created_by: string | null
          id: string
          observations: string
          pdf_name: string | null
          pdf_url: string | null
          planned_date: string | null
          status: Database["public"]["Enums"]["text_content_status"]
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          client_label?: string
          content_type?: Database["public"]["Enums"]["text_content_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: string
          pdf_name?: string | null
          pdf_url?: string | null
          planned_date?: string | null
          status?: Database["public"]["Enums"]["text_content_status"]
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          client_label?: string
          content_type?: Database["public"]["Enums"]["text_content_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: string
          pdf_name?: string | null
          pdf_url?: string | null
          planned_date?: string | null
          status?: Database["public"]["Enums"]["text_content_status"]
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_contents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_order: {
        Row: {
          client_id: string
          id: string
          post_ids: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          id?: string
          post_ids?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          post_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_order_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_steps: {
        Row: {
          client_id: string
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracking_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_client_assignments: {
        Row: {
          assigned_by: string | null
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_countries: {
        Row: {
          country: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quick_links: {
        Row: {
          created_at: string
          icon_url: string
          id: string
          position: number
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon_url?: string
          id?: string
          position?: number
          title?: string
          url?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon_url?: string
          id?: string
          position?: number
          title?: string
          url?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      visual_directions: {
        Row: {
          brand_name: string
          category: string
          client_id: string
          colors: string[]
          composition: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          image_style: string
          lighting: string
          things_to_avoid: string
          typography: string
          updated_at: string
        }
        Insert: {
          brand_name?: string
          category: string
          client_id: string
          colors?: string[]
          composition?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          image_style?: string
          lighting?: string
          things_to_avoid?: string
          typography?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          category?: string
          client_id?: string
          colors?: string[]
          composition?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          image_style?: string
          lighting?: string
          things_to_avoid?: string
          typography?: string
          updated_at?: string
        }
        Relationships: []
      }
      words_to_avoid: {
        Row: {
          category: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string
          recommended_alternative: string
          updated_at: string
          word: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          recommended_alternative?: string
          updated_at?: string
          word: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          recommended_alternative?: string
          updated_at?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_proposal: {
        Args: {
          p_email: string
          p_ip: string
          p_name: string
          p_signature: string
          p_token: string
        }
        Returns: {
          accepted_at: string | null
          accepted_email: string
          accepted_ip: string
          accepted_name: string
          accepted_signature: string
          client_email: string
          client_name: string
          created_at: string
          currency: string
          deadline_days: number
          expires_at: string
          id: string
          investment_description: string
          locale: string
          pieces_quantity: number
          plan: string
          proposal_type: string
          scope_description: string
          services: Json
          status: Database["public"]["Enums"]["proposal_status"]
          token: string
          total_value: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      client_can_edit_brand_brain: {
        Args: { _client_id: string }
        Returns: boolean
      }
      delete_orphaned_media_files: {
        Args: { older_than_hours?: number }
        Returns: number
      }
      extract_media_storage_paths: {
        Args: { urls: string[] }
        Returns: string[]
      }
      get_approval_token_by_token: {
        Args: { p_token: string }
        Returns: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          post_id: string | null
          token: string
          token_type: string
          used_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_client_by_approval_token: {
        Args: { p_token: string }
        Returns: {
          id: string
          locale: string
          logo_url: string
          name: string
        }[]
      }
      get_public_brief_by_token: {
        Args: { p_token: string }
        Returns: {
          additional_notes: string
          answers: Json
          brand_name: string
          category: string
          client_id: string | null
          created_at: string
          id: string
          locale: string
          objectives: string
          preferred_colors: string
          references_links: string
          respondent_email: string
          respondent_name: string
          status: string
          style_preferences: string
          submitted_at: string | null
          target_audience: string
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "design_briefs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_proposal_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string | null
          accepted_email: string
          accepted_ip: string
          accepted_name: string
          accepted_signature: string
          client_email: string
          client_name: string
          created_at: string
          currency: string
          deadline_days: number
          expires_at: string
          id: string
          investment_description: string
          locale: string
          pieces_quantity: number
          plan: string
          proposal_type: string
          scope_description: string
          services: Json
          status: Database["public"]["Enums"]["proposal_status"]
          token: string
          total_value: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_client_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_orphaned_media_files: {
        Args: { older_than_hours?: number }
        Returns: {
          created_at: string
          name: string
          size: number
        }[]
      }
      mark_proposal_expired: { Args: { p_token: string }; Returns: undefined }
      mark_proposal_viewed: { Args: { p_token: string }; Returns: undefined }
      submit_public_brief_by_token: {
        Args: {
          p_answers: Json
          p_respondent_email: string
          p_respondent_name: string
          p_token: string
        }
        Returns: {
          additional_notes: string
          answers: Json
          brand_name: string
          category: string
          client_id: string | null
          created_at: string
          id: string
          locale: string
          objectives: string
          preferred_colors: string
          references_links: string
          respondent_email: string
          respondent_name: string
          status: string
          style_preferences: string
          submitted_at: string | null
          target_audience: string
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "design_briefs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "team_member"
        | "client"
        | "super_admin"
        | "colaborador"
      brief_status:
        | "draft"
        | "internal"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "published"
      calendar_post_status:
        | "draft"
        | "in_review"
        | "approved"
        | "scheduled"
        | "published"
      invoice_status: "open" | "paid" | "overdue" | "cancelled"
      proposal_status: "draft" | "sent" | "viewed" | "accepted" | "expired"
      social_post_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "scheduled"
        | "publishing"
        | "published"
        | "error"
        | "cancelled"
      text_content_status:
        | "draft"
        | "internal"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "published"
      text_content_type: "blog" | "artigo" | "texto" | "copy" | "documento"
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
      app_role: [
        "admin",
        "team_member",
        "client",
        "super_admin",
        "colaborador",
      ],
      brief_status: [
        "draft",
        "internal",
        "pending_approval",
        "approved",
        "rejected",
        "published",
      ],
      calendar_post_status: [
        "draft",
        "in_review",
        "approved",
        "scheduled",
        "published",
      ],
      invoice_status: ["open", "paid", "overdue", "cancelled"],
      proposal_status: ["draft", "sent", "viewed", "accepted", "expired"],
      social_post_status: [
        "draft",
        "pending_approval",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "error",
        "cancelled",
      ],
      text_content_status: [
        "draft",
        "internal",
        "pending_approval",
        "approved",
        "rejected",
        "published",
      ],
      text_content_type: ["blog", "artigo", "texto", "copy", "documento"],
    },
  },
} as const
