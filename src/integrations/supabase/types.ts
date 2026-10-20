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
      campaigns: {
        Row: {
          budget: number
          channel: Database["public"]["Enums"]["campaign_channel"]
          conversions: number
          created_at: string
          end_date: string | null
          id: string
          leads_generated: number
          name: string
          start_date: string
          status: Database["public"]["Enums"]["campaign_status"]
        }
        Insert: {
          budget?: number
          channel: Database["public"]["Enums"]["campaign_channel"]
          conversions?: number
          created_at?: string
          end_date?: string | null
          id?: string
          leads_generated?: number
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Update: {
          budget?: number
          channel?: Database["public"]["Enums"]["campaign_channel"]
          conversions?: number
          created_at?: string
          end_date?: string | null
          id?: string
          leads_generated?: number
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Relationships: []
      }
      client_projects: {
        Row: {
          client_name: string | null
          client_phone: string
          completed_at: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          seller_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_phone: string
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          seller_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_phone?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          seller_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          alert_notified_at: string | null
          alert_status: string | null
          assigned_seller_id: string | null
          city: string | null
          claimed_at: string | null
          client_type: string | null
          contact_category: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          erp_id: string | null
          hidden_at: string | null
          holiday_notified_on: string | null
          id: string
          last_contact: string | null
          last_message_at: string | null
          last_message_from_client_at: string | null
          last_purchase_at: string | null
          last_seller_response_at: string | null
          linked_erp_client_id: string | null
          linked_erp_client_name: string | null
          name: string
          notes: string | null
          pending_store_preference: string | null
          phone: string
          profile_pic_url: string | null
          purchase_count: number
          received_on_instance_id: string | null
          status: string | null
          store_id: string | null
          tags: string[]
          total_purchases: number
          triage_code_attempts: number
          triage_step: string | null
          triaging: boolean | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          alert_notified_at?: string | null
          alert_status?: string | null
          assigned_seller_id?: string | null
          city?: string | null
          claimed_at?: string | null
          client_type?: string | null
          contact_category?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          erp_id?: string | null
          hidden_at?: string | null
          holiday_notified_on?: string | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          last_message_from_client_at?: string | null
          last_purchase_at?: string | null
          last_seller_response_at?: string | null
          linked_erp_client_id?: string | null
          linked_erp_client_name?: string | null
          name: string
          notes?: string | null
          pending_store_preference?: string | null
          phone: string
          profile_pic_url?: string | null
          purchase_count?: number
          received_on_instance_id?: string | null
          status?: string | null
          store_id?: string | null
          tags?: string[]
          total_purchases?: number
          triage_code_attempts?: number
          triage_step?: string | null
          triaging?: boolean | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          alert_notified_at?: string | null
          alert_status?: string | null
          assigned_seller_id?: string | null
          city?: string | null
          claimed_at?: string | null
          client_type?: string | null
          contact_category?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          erp_id?: string | null
          hidden_at?: string | null
          holiday_notified_on?: string | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          last_message_from_client_at?: string | null
          last_purchase_at?: string | null
          last_seller_response_at?: string | null
          linked_erp_client_id?: string | null
          linked_erp_client_name?: string | null
          name?: string
          notes?: string | null
          pending_store_preference?: string | null
          phone?: string
          profile_pic_url?: string | null
          purchase_count?: number
          received_on_instance_id?: string | null
          status?: string | null
          store_id?: string | null
          tags?: string[]
          total_purchases?: number
          triage_code_attempts?: number
          triage_step?: string | null
          triaging?: boolean | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_seller_id_fkey"
            columns: ["assigned_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_pending_store_preference_fkey"
            columns: ["pending_store_preference"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_received_on_instance_id_fkey"
            columns: ["received_on_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_to: string | null
          client_name: string
          client_phone: string
          completed: boolean
          created_at: string
          description: string
          id: string
          last_notified_at: string | null
          lead_id: string | null
          scheduled_at: string
          store_id: string | null
          type: Database["public"]["Enums"]["follow_up_type"]
        }
        Insert: {
          assigned_to?: string | null
          client_name: string
          client_phone: string
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          last_notified_at?: string | null
          lead_id?: string | null
          scheduled_at: string
          store_id?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
        }
        Update: {
          assigned_to?: string | null
          client_name?: string
          client_phone?: string
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          last_notified_at?: string | null
          lead_id?: string | null
          scheduled_at?: string
          store_id?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          lead_id: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_redirections: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          original_seller_id: string | null
          reason: string
          redirected_to_seller_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          original_seller_id?: string | null
          reason: string
          redirected_to_seller_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          original_seller_id?: string | null
          reason?: string
          redirected_to_seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_redirections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_redirections_original_seller_id_fkey"
            columns: ["original_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_redirections_redirected_to_seller_id_fkey"
            columns: ["redirected_to_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean
          assigned_to: string | null
          client_email: string | null
          client_name: string
          client_phone: string
          client_type: string | null
          closed_at: string | null
          company_work_site: string | null
          created_at: string
          hidden_at: string | null
          id: string
          interest_products: string | null
          lost_reason: string | null
          next_follow_up: string | null
          notes: string
          snoozed_until: string | null
          source: string
          stage: Database["public"]["Enums"]["kanban_stage"]
          store_id: string | null
          store_name: string | null
          tags: string[]
          updated_at: string
          urgency_acknowledged_at: string | null
          value: number
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          client_email?: string | null
          client_name: string
          client_phone: string
          client_type?: string | null
          closed_at?: string | null
          company_work_site?: string | null
          created_at?: string
          hidden_at?: string | null
          id?: string
          interest_products?: string | null
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string
          snoozed_until?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["kanban_stage"]
          store_id?: string | null
          store_name?: string | null
          tags?: string[]
          updated_at?: string
          urgency_acknowledged_at?: string | null
          value?: number
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string
          client_type?: string | null
          closed_at?: string | null
          company_work_site?: string | null
          created_at?: string
          hidden_at?: string | null
          id?: string
          interest_products?: string | null
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string
          snoozed_until?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["kanban_stage"]
          store_id?: string | null
          store_name?: string | null
          tags?: string[]
          updated_at?: string
          urgency_acknowledged_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          role_target: string | null
          store_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          role_target?: string | null
          store_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          role_target?: string | null
          store_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_request_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pricing_support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_request_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pricing_support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_support_requests: {
        Row: {
          assigned_to: string | null
          audio_url: string | null
          category: string
          client_name: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          erp_client_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          pdf_name: string | null
          pdf_url: string | null
          request_type: string | null
          responded_at: string | null
          responded_by_name: string | null
          response_notes: string | null
          response_pdf_name: string | null
          response_pdf_url: string | null
          seller_id: string | null
          status: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          audio_url?: string | null
          category?: string
          client_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          erp_client_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          request_type?: string | null
          responded_at?: string | null
          responded_by_name?: string | null
          response_notes?: string | null
          response_pdf_name?: string | null
          response_pdf_url?: string | null
          seller_id?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          audio_url?: string | null
          category?: string
          client_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          erp_client_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          request_type?: string | null
          responded_at?: string | null
          responded_by_name?: string | null
          response_notes?: string | null
          response_pdf_name?: string | null
          response_pdf_url?: string | null
          seller_id?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_support_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_support_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_support_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_support_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          must_change_password: boolean
          role: string | null
          sla_target_minutes: number | null
          store_id: string | null
          substitute_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean
          role?: string | null
          sla_target_minutes?: number | null
          store_id?: string | null
          substitute_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean
          role?: string | null
          sla_target_minutes?: number | null
          store_id?: string | null
          substitute_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string
          correct_answers: number
          id: string
          is_penalty: boolean
          score: number
          segment_breakdown: Json | null
          skipped_inactive: boolean
          subject_breakdown: Json | null
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          correct_answers: number
          id?: string
          is_penalty?: boolean
          score?: number
          segment_breakdown?: Json | null
          skipped_inactive?: boolean
          subject_breakdown?: Json | null
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string
          correct_answers?: number
          id?: string
          is_penalty?: boolean
          score?: number
          segment_breakdown?: Json | null
          skipped_inactive?: boolean
          subject_breakdown?: Json | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          code: string | null
          correct_option_index: number
          created_at: string
          difficulty: string | null
          id: string
          options: Json
          paint_types: string[] | null
          question: string
          subject: string | null
        }
        Insert: {
          code?: string | null
          correct_option_index: number
          created_at?: string
          difficulty?: string | null
          id?: string
          options: Json
          paint_types?: string[] | null
          question: string
          subject?: string | null
        }
        Update: {
          code?: string | null
          correct_option_index?: number
          created_at?: string
          difficulty?: string | null
          id?: string
          options?: Json
          paint_types?: string[] | null
          question?: string
          subject?: string | null
        }
        Relationships: []
      }
      quiz_seen_questions: {
        Row: {
          last_seen_at: string
          question_id: string
          seen_count: number
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          question_id: string
          seen_count?: number
          user_id: string
        }
        Update: {
          last_seen_at?: string
          question_id?: string
          seen_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_seen_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      redirection_history: {
        Row: {
          client_id: string | null
          created_at: string | null
          from_seller_id: string | null
          id: string
          performed_by: string | null
          reason: string | null
          redirection_type: string
          store_id: string | null
          to_seller_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          redirection_type: string
          store_id?: string | null
          to_seller_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          redirection_type?: string
          store_id?: string | null
          to_seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redirection_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirection_history_from_seller_id_fkey"
            columns: ["from_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirection_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirection_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirection_history_to_seller_id_fkey"
            columns: ["to_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          avatar: string | null
          code: string | null
          conversions: number
          created_at: string
          distribution_priority: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          is_support_supervisor: boolean
          last_assigned_at: string | null
          leads_count: number
          name: string
          quiz_monthly_goal: number | null
          quiz_subjects: string[] | null
          role: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes: number | null
          status: string | null
          store_id: string | null
          substitute_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar?: string | null
          code?: string | null
          conversions?: number
          created_at?: string
          distribution_priority?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          is_support_supervisor?: boolean
          last_assigned_at?: string | null
          leads_count?: number
          name: string
          quiz_monthly_goal?: number | null
          quiz_subjects?: string[] | null
          role?: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes?: number | null
          status?: string | null
          store_id?: string | null
          substitute_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar?: string | null
          code?: string | null
          conversions?: number
          created_at?: string
          distribution_priority?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          is_support_supervisor?: boolean
          last_assigned_at?: string | null
          leads_count?: number
          name?: string
          quiz_monthly_goal?: number | null
          quiz_subjects?: string[] | null
          role?: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes?: number | null
          status?: string | null
          store_id?: string | null
          substitute_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sellers_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_transfers: {
        Row: {
          client_id: string
          created_at: string | null
          from_seller_id: string | null
          id: string
          performed_by: string | null
          reason: string | null
          to_seller_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          to_seller_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          to_seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_transfers_from_seller_id_fkey"
            columns: ["from_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_transfers_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_transfers_to_seller_id_fkey"
            columns: ["to_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auto_return_leads: boolean | null
          company_name: string
          created_at: string
          id: string
          notify_follow_up_reminders: boolean
          notify_new_leads: boolean
          notify_overdue_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_return_leads?: boolean | null
          company_name?: string
          created_at?: string
          id?: string
          notify_follow_up_reminders?: boolean
          notify_new_leads?: boolean
          notify_overdue_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_return_leads?: boolean | null
          company_name?: string
          created_at?: string
          id?: string
          notify_follow_up_reminders?: boolean
          notify_new_leads?: boolean
          notify_overdue_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sla_alerts: {
        Row: {
          alert_level: string
          alert_type: string
          created_at: string
          id: string
          last_reminder_at: string | null
          lead_id: string | null
          message: string
          resolved_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          alert_level: string
          alert_type: string
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          lead_id?: string | null
          message: string
          resolved_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          alert_level?: string
          alert_type?: string
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          lead_id?: string | null
          message?: string
          resolved_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_alerts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_alerts_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          message: string | null
          redirect_store_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          message?: string | null
          redirect_store_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          message?: string | null
          redirect_store_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_holidays_redirect_store_id_fkey"
            columns: ["redirect_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_holidays_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          close_time: string | null
          created_at: string
          employee_count: number
          erp_company_code: string | null
          id: string
          is_external_team: boolean
          name: string
          open_time: string | null
          opens_saturday: boolean
          opens_sunday: boolean
          phone: string | null
          sat_close_time: string | null
          sat_open_time: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          close_time?: string | null
          created_at?: string
          employee_count?: number
          erp_company_code?: string | null
          id?: string
          is_external_team?: boolean
          name: string
          open_time?: string | null
          opens_saturday?: boolean
          opens_sunday?: boolean
          phone?: string | null
          sat_close_time?: string | null
          sat_open_time?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          close_time?: string | null
          created_at?: string
          employee_count?: number
          erp_company_code?: string | null
          id?: string
          is_external_team?: boolean
          name?: string
          open_time?: string | null
          opens_saturday?: boolean
          opens_sunday?: boolean
          phone?: string | null
          sat_close_time?: string | null
          sat_open_time?: string | null
        }
        Relationships: []
      }
      support_breaks: {
        Row: {
          break_date: string
          created_at: string
          ended_at: string | null
          id: string
          seller_id: string
          started_at: string
        }
        Insert: {
          break_date?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          seller_id: string
          started_at?: string
        }
        Update: {
          break_date?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          seller_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_breaks_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_request_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          from_seller_id: string | null
          id: string
          note: string | null
          request_id: string
          to_seller_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          from_seller_id?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_seller_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          from_seller_id?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_request_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_request_assignments_from_seller_id_fkey"
            columns: ["from_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_request_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pricing_support_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_request_assignments_to_seller_id_fkey"
            columns: ["to_seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modules: {
        Row: {
          module_id: string
          user_id: string
        }
        Insert: {
          module_id: string
          user_id: string
        }
        Update: {
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_instances: {
        Row: {
          api_token: string | null
          api_url: string | null
          created_at: string
          id: string
          instance_type: Database["public"]["Enums"]["whatsapp_instance_type"]
          last_connected_at: string | null
          name: string
          phone_number: string
          provider: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code: string | null
          seller_id: string | null
          silence_alert_hours: number
          silence_alerted_at: string | null
          status: Database["public"]["Enums"]["whatsapp_instance_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_type: Database["public"]["Enums"]["whatsapp_instance_type"]
          last_connected_at?: string | null
          name: string
          phone_number: string
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code?: string | null
          seller_id?: string | null
          silence_alert_hours?: number
          silence_alerted_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_instance_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_type?: Database["public"]["Enums"]["whatsapp_instance_type"]
          last_connected_at?: string | null
          name?: string
          phone_number?: string
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          qr_code?: string | null
          seller_id?: string | null
          silence_alert_hours?: number
          silence_alerted_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_instance_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string | null
          hidden_at: string | null
          id: string
          is_from_me: boolean | null
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message_id: string
          phone: string
          raw_data: Json | null
          received_on_instance_id: string | null
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          hidden_at?: string | null
          id?: string
          is_from_me?: boolean | null
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id: string
          phone: string
          raw_data?: Json | null
          received_on_instance_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          hidden_at?: string | null
          id?: string
          is_from_me?: boolean | null
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id?: string
          phone?: string
          raw_data?: Json | null
          received_on_instance_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_received_on_instance_id_fkey"
            columns: ["received_on_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_lead: {
        Args: { _lead_id: string; _seller_id: string }
        Returns: Json
      }
      admin_assign_user_role: {
        Args: {
          _is_active?: boolean
          _is_available?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _seller_code?: string
          _seller_name?: string
          _status?: string
          _store_id?: string
          _substitute_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_assign_user_roles:
        | {
            Args: {
              _is_active?: boolean
              _is_available?: boolean
              _roles: Database["public"]["Enums"]["app_role"][]
              _seller_code?: string
              _seller_name?: string
              _status?: string
              _store_id?: string
              _substitute_id?: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _is_active?: boolean
              _is_available?: boolean
              _is_support_supervisor?: boolean
              _roles: Database["public"]["Enums"]["app_role"][]
              _seller_code?: string
              _seller_name?: string
              _status?: string
              _store_id?: string
              _substitute_id?: string
              _user_id: string
            }
            Returns: undefined
          }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_active: boolean
          is_available: boolean
          role: Database["public"]["Enums"]["app_role"]
          roles: string
          seller_code: string
          seller_id: string
          seller_name: string
          status: string
          store_id: string
          store_name: string
          substitute_id: string
          substitute_name: string
          user_id: string
        }[]
      }
      admin_revoke_user_role: { Args: { _user_id: string }; Returns: undefined }
      assign_client_by_seller_code: {
        Args: { _code: string; _phone: string }
        Returns: {
          id: string
          name: string
          store_id: string
        }[]
      }
      assign_client_with_redirection: {
        Args: { _phone: string; _seller_id: string }
        Returns: Json
      }
      bump_triage_code_attempts: {
        Args: { p_client_id: string }
        Returns: number
      }
      check_whatsapp_silence: { Args: never; Returns: number }
      claim_whatsapp_client: {
        Args: { _fallback_name?: string; _phone: string }
        Returns: {
          client_id: string
          seller_id: string
          store_id: string
        }[]
      }
      get_admin_display_name: { Args: never; Returns: string }
      get_next_seller_for_distribution: {
        Args: { _store_id: string }
        Returns: {
          avatar: string | null
          code: string | null
          conversions: number
          created_at: string
          distribution_priority: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          is_support_supervisor: boolean
          last_assigned_at: string | null
          leads_count: number
          name: string
          quiz_monthly_goal: number | null
          quiz_subjects: string[] | null
          role: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes: number | null
          status: string | null
          store_id: string | null
          substitute_id: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sellers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_quiz_leaderboard: {
        Args: { limit_count?: number; p_since?: string }
        Returns: {
          attempts: number
          avatar_url: string
          best_score: number
          display_name: string
          user_id: string
        }[]
      }
      get_random_seller_by_city: {
        Args: { _city: string }
        Returns: {
          avatar: string | null
          code: string | null
          conversions: number
          created_at: string
          distribution_priority: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          is_support_supervisor: boolean
          last_assigned_at: string | null
          leads_count: number
          name: string
          quiz_monthly_goal: number | null
          quiz_subjects: string[] | null
          role: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes: number | null
          status: string | null
          store_id: string | null
          substitute_id: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sellers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_seller_id: { Args: { _user_id: string }; Returns: string }
      get_user_store_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_valid_br_phone: { Args: { p: string }; Returns: boolean }
      list_support_sellers: {
        Args: never
        Returns: {
          is_support_supervisor: boolean
          name: string
          seller_id: string
          store_id: string
          store_name: string
        }[]
      }
      mark_questions_seen: {
        Args: { p_question_ids: string[] }
        Returns: undefined
      }
      mark_seller_assigned: { Args: { _seller_id: string }; Returns: undefined }
      mark_whatsapp_read: { Args: { p_phone: string }; Returns: number }
      notify_quiz_reminder: { Args: never; Returns: undefined }
      transfer_attendance: {
        Args: {
          p_client_id?: string
          p_lead_id?: string
          p_reason?: string
          p_seller_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "vendedor" | "suporte"
      campaign_channel:
        | "whatsapp"
        | "meta"
        | "instagram"
        | "google"
        | "indicacao"
      campaign_status: "active" | "paused" | "completed"
      follow_up_type: "call" | "whatsapp" | "visit" | "email"
      interaction_type: "whatsapp" | "phone" | "email" | "visit" | "note"
      kanban_stage:
        | "abordagem"
        | "sondagem"
        | "recomendacao_tecnica"
        | "demonstracao_valor"
        | "contorno_objecoes"
        | "precificacao_especial"
        | "cross_sell"
        | "fechamento"
        | "pos_venda"
        | "perdido"
      seller_role: "vendedor" | "gerente"
      whatsapp_instance_status:
        | "disconnected"
        | "qr_pending"
        | "connected"
        | "error"
      whatsapp_instance_type: "store" | "seller"
      whatsapp_provider: "uazapi" | "meta_cloud" | "whatsapi"
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
      app_role: ["admin", "gerente", "vendedor", "suporte"],
      campaign_channel: [
        "whatsapp",
        "meta",
        "instagram",
        "google",
        "indicacao",
      ],
      campaign_status: ["active", "paused", "completed"],
      follow_up_type: ["call", "whatsapp", "visit", "email"],
      interaction_type: ["whatsapp", "phone", "email", "visit", "note"],
      kanban_stage: [
        "abordagem",
        "sondagem",
        "recomendacao_tecnica",
        "demonstracao_valor",
        "contorno_objecoes",
        "precificacao_especial",
        "cross_sell",
        "fechamento",
        "pos_venda",
        "perdido",
      ],
      seller_role: ["vendedor", "gerente"],
      whatsapp_instance_status: [
        "disconnected",
        "qr_pending",
        "connected",
        "error",
      ],
      whatsapp_instance_type: ["store", "seller"],
      whatsapp_provider: ["uazapi", "meta_cloud", "whatsapi"],
    },
  },
} as const
