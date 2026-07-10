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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          dba: string | null
          id: string
          legal_name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          dba?: string | null
          id?: string
          legal_name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          dba?: string | null
          id?: string
          legal_name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          agency: string | null
          archived_at: string | null
          authorized_negotiator_email: string | null
          authorized_negotiator_status: string
          created_at: string
          current_stage: Database["public"]["Enums"]["offer_stage"]
          documents_in_review: number
          id: string
          name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          open_client_items: number
          organization_id: string
          owner_user_id: string | null
          readiness_percent: number
          selected_sins: Json
          solicitation_number: string | null
          status: Database["public"]["Enums"]["offer_status"]
          submission_status: string
          target_submission_date: string | null
          updated_at: string
        }
        Insert: {
          agency?: string | null
          archived_at?: string | null
          authorized_negotiator_email?: string | null
          authorized_negotiator_status?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["offer_stage"]
          documents_in_review?: number
          id?: string
          name: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          open_client_items?: number
          organization_id: string
          owner_user_id?: string | null
          readiness_percent?: number
          selected_sins?: Json
          solicitation_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          submission_status?: string
          target_submission_date?: string | null
          updated_at?: string
        }
        Update: {
          agency?: string | null
          archived_at?: string | null
          authorized_negotiator_email?: string | null
          authorized_negotiator_status?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["offer_stage"]
          documents_in_review?: number
          id?: string
          name?: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          open_client_items?: number
          organization_id?: string
          owner_user_id?: string | null
          readiness_percent?: number
          selected_sins?: Json
          solicitation_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          submission_status?: string
          target_submission_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_members: {
        Row: {
          created_at: string
          id: string
          invitation_email: string | null
          is_active: boolean
          offer_id: string
          role: Database["public"]["Enums"]["offer_member_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_email?: string | null
          is_active?: boolean
          offer_id: string
          role?: Database["public"]["Enums"]["offer_member_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invitation_email?: string | null
          is_active?: boolean
          offer_id?: string
          role?: Database["public"]["Enums"]["offer_member_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_members_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_activity: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          module: string
          offer_id: string
          target: string | null
          visibility: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          module: string
          offer_id: string
          target?: string | null
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          module?: string
          offer_id?: string
          target?: string | null
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "offer_activity_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_access_offer: {
        Args: {
          _offer_id: string
        }
        Returns: boolean
      }
      can_access_organization: {
        Args: {
          _organization_id: string
        }
        Returns: boolean
      }
      is_offer_member: {
        Args: {
          _offer_id: string
        }
        Returns: boolean
      }
      role_for_email: {
        Args: {
          _email: string
        }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "admin" | "client"
      offer_activity_visibility: "admin" | "client"
      offer_member_role:
        | "admin_lead"
        | "reviewer"
        | "client_contributor"
        | "authorized_negotiator"
        | "viewer"
      offer_stage:
        | "intake"
        | "readiness"
        | "automation"
        | "review"
        | "submission"
        | "post_submission"
      offer_status: "active" | "blocked" | "submitted" | "awarded" | "archived"
      offer_type: "gsa_mas" | "va_fss" | "gwac_rfp" | "custom_solicitation"
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
      app_role: ["admin", "client"],
      offer_activity_visibility: ["admin", "client"],
      offer_member_role: [
        "admin_lead",
        "reviewer",
        "client_contributor",
        "authorized_negotiator",
        "viewer",
      ],
      offer_stage: [
        "intake",
        "readiness",
        "automation",
        "review",
        "submission",
        "post_submission",
      ],
      offer_status: ["active", "blocked", "submitted", "awarded", "archived"],
      offer_type: ["gsa_mas", "va_fss", "gwac_rfp", "custom_solicitation"],
    },
  },
} as const
