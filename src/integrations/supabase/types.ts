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
      clients: {
        Row: {
          address: string | null
          alert_notified_at: string | null
          alert_status: string | null
          assigned_seller_id: string | null
          city: string | null
          claimed_at: string | null
          created_at: string
          email: string | null
          id: string
          last_contact: string | null
          last_message_at: string | null
          last_message_from_client_at: string | null
          last_seller_response_at: string | null
          name: string
          notes: string | null
          phone: string
          status: string | null
          store_id: string | null
          tags: string[]
          total_purchases: number
        }
        Insert: {
          address?: string | null
          alert_notified_at?: string | null
          alert_status?: string | null
          assigned_seller_id?: string | null
          city?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          last_message_from_client_at?: string | null
          last_seller_response_at?: string | null
          name: string
          notes?: string | null
          phone: string
          status?: string | null
          store_id?: string | null
          tags?: string[]
          total_purchases?: number
        }
        Update: {
          address?: string | null
          alert_notified_at?: string | null
          alert_status?: string | null
          assigned_seller_id?: string | null
          city?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          last_message_from_client_at?: string | null
          last_seller_response_at?: string | null
          name?: string
          notes?: string | null
          phone?: string
          status?: string | null
          store_id?: string | null
          tags?: string[]
          total_purchases?: number
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
      leads: {
        Row: {
          assigned_to: string | null
          client_email: string | null
          client_name: string
          client_phone: string
          created_at: string
          id: string
          next_follow_up: string | null
          notes: string
          source: string
          stage: Database["public"]["Enums"]["kanban_stage"]
          store_id: string | null
          tags: string[]
          updated_at: string
          value: number
        }
        Insert: {
          assigned_to?: string | null
          client_email?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          id?: string
          next_follow_up?: string | null
          notes?: string
          source?: string
          stage?: Database["public"]["Enums"]["kanban_stage"]
          store_id?: string | null
          tags?: string[]
          updated_at?: string
          value?: number
        }
        Update: {
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          next_follow_up?: string | null
          notes?: string
          source?: string
          stage?: Database["public"]["Enums"]["kanban_stage"]
          store_id?: string | null
          tags?: string[]
          updated_at?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean | null
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
          id?: string
          is_active?: boolean | null
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
          id?: string
          is_active?: boolean | null
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
      sellers: {
        Row: {
          avatar: string | null
          conversions: number
          created_at: string
          id: string
          leads_count: number
          name: string
          role: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes: number | null
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar?: string | null
          conversions?: number
          created_at?: string
          id?: string
          leads_count?: number
          name: string
          role?: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes?: number | null
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar?: string | null
          conversions?: number
          created_at?: string
          id?: string
          leads_count?: number
          name?: string
          role?: Database["public"]["Enums"]["seller_role"]
          sla_target_minutes?: number | null
          store_id?: string | null
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
        ]
      }
      service_transfers: {
        Row: {
          client_id: string
          created_at: string | null
          from_seller_id: string | null
          id: string
          reason: string | null
          to_seller_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
          reason?: string | null
          to_seller_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          from_seller_id?: string | null
          id?: string
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_transfers_to_seller_id_fkey"
            columns: ["to_seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          lead_id: string | null
          message: string
          vendedor_id: string | null
        }
        Insert: {
          alert_level: string
          alert_type: string
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          vendedor_id?: string | null
        }
        Update: {
          alert_level?: string
          alert_type?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
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
      stores: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          employee_count: number
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          employee_count?: number
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          employee_count?: number
          id?: string
          name?: string
          phone?: string | null
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
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_from_me: boolean | null
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message_id: string
          phone: string
          raw_data: Json | null
          timestamp: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_from_me?: boolean | null
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id: string
          phone: string
          raw_data?: Json | null
          timestamp?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_from_me?: boolean | null
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id?: string
          phone?: string
          raw_data?: Json | null
          timestamp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _seller_name?: string
          _store_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          seller_id: string
          seller_name: string
          store_id: string
          store_name: string
          user_id: string
        }[]
      }
      admin_revoke_user_role: { Args: { _user_id: string }; Returns: undefined }
      get_user_seller_id: { Args: { _user_id: string }; Returns: string }
      get_user_store_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
        | "cross_sell"
        | "fechamento"
        | "pos_venda"
      seller_role: "vendedor" | "gerente"
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
        "cross_sell",
        "fechamento",
        "pos_venda",
      ],
      seller_role: ["vendedor", "gerente"],
    },
  },
} as const
