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
          city: string | null
          created_at: string
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          phone: string
          tags: string[]
          total_purchases: number
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          phone: string
          tags?: string[]
          total_purchases?: number
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          phone?: string
          tags?: string[]
          total_purchases?: number
        }
        Relationships: []
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
        }
        Insert: {
          avatar?: string | null
          conversions?: number
          created_at?: string
          id?: string
          leads_count?: number
          name: string
          role?: Database["public"]["Enums"]["seller_role"]
        }
        Update: {
          avatar?: string | null
          conversions?: number
          created_at?: string
          id?: string
          leads_count?: number
          name?: string
          role?: Database["public"]["Enums"]["seller_role"]
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_from_me: boolean | null
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
      [_ in never]: never
    }
    Enums: {
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
        | "novo_lead"
        | "em_atendimento"
        | "orcamento_enviado"
        | "negociacao"
        | "fechado"
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
        "novo_lead",
        "em_atendimento",
        "orcamento_enviado",
        "negociacao",
        "fechado",
      ],
      seller_role: ["vendedor", "gerente"],
    },
  },
} as const
