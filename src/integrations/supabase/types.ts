export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          company: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          created_at: string;
          dba: string | null;
          id: string;
          legal_name: string;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          status: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          dba?: string | null;
          id?: string;
          legal_name: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          status?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          dba?: string | null;
          id?: string;
          legal_name?: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          status?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      offers: {
        Row: {
          agency: string | null;
          archived_at: string | null;
          authorized_negotiator_email: string | null;
          authorized_negotiator_status: string;
          created_at: string;
          current_stage: Database["public"]["Enums"]["offer_stage"];
          documents_in_review: number;
          id: string;
          name: string;
          offer_type: Database["public"]["Enums"]["offer_type"];
          open_client_items: number;
          organization_id: string;
          owner_user_id: string | null;
          readiness_percent: number;
          selected_sins: Json;
          solicitation_number: string | null;
          status: Database["public"]["Enums"]["offer_status"];
          submission_status: string;
          target_submission_date: string | null;
          updated_at: string;
        };
        Insert: {
          agency?: string | null;
          archived_at?: string | null;
          authorized_negotiator_email?: string | null;
          authorized_negotiator_status?: string;
          created_at?: string;
          current_stage?: Database["public"]["Enums"]["offer_stage"];
          documents_in_review?: number;
          id?: string;
          name: string;
          offer_type?: Database["public"]["Enums"]["offer_type"];
          open_client_items?: number;
          organization_id: string;
          owner_user_id?: string | null;
          readiness_percent?: number;
          selected_sins?: Json;
          solicitation_number?: string | null;
          status?: Database["public"]["Enums"]["offer_status"];
          submission_status?: string;
          target_submission_date?: string | null;
          updated_at?: string;
        };
        Update: {
          agency?: string | null;
          archived_at?: string | null;
          authorized_negotiator_email?: string | null;
          authorized_negotiator_status?: string;
          created_at?: string;
          current_stage?: Database["public"]["Enums"]["offer_stage"];
          documents_in_review?: number;
          id?: string;
          name?: string;
          offer_type?: Database["public"]["Enums"]["offer_type"];
          open_client_items?: number;
          organization_id?: string;
          owner_user_id?: string | null;
          readiness_percent?: number;
          selected_sins?: Json;
          solicitation_number?: string | null;
          status?: Database["public"]["Enums"]["offer_status"];
          submission_status?: string;
          target_submission_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "offers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      offer_members: {
        Row: {
          created_at: string;
          id: string;
          invitation_email: string | null;
          is_active: boolean;
          offer_id: string;
          role: Database["public"]["Enums"]["offer_member_role"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invitation_email?: string | null;
          is_active?: boolean;
          offer_id: string;
          role?: Database["public"]["Enums"]["offer_member_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          invitation_email?: string | null;
          is_active?: boolean;
          offer_id?: string;
          role?: Database["public"]["Enums"]["offer_member_role"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "offer_members_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
        ];
      };
      offer_activity: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          id: string;
          module: string;
          offer_id: string;
          target: string | null;
          visibility: Database["public"]["Enums"]["offer_activity_visibility"];
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          module: string;
          offer_id: string;
          target?: string | null;
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"];
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          module?: string;
          offer_id?: string;
          target?: string | null;
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "offer_activity_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_runs: {
        Row: {
          client_visible: boolean;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          input: Json;
          metrics: Json;
          module: Database["public"]["Enums"]["automation_module"];
          offer_id: string;
          source_urls: string[];
          started_at: string;
          status: Database["public"]["Enums"]["automation_run_status"];
          updated_at: string;
        };
        Insert: {
          client_visible?: boolean;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          input?: Json;
          metrics?: Json;
          module: Database["public"]["Enums"]["automation_module"];
          offer_id: string;
          source_urls?: string[];
          started_at?: string;
          status?: Database["public"]["Enums"]["automation_run_status"];
          updated_at?: string;
        };
        Update: {
          client_visible?: boolean;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          input?: Json;
          metrics?: Json;
          module?: Database["public"]["Enums"]["automation_module"];
          offer_id?: string;
          source_urls?: string[];
          started_at?: string;
          status?: Database["public"]["Enums"]["automation_run_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_runs_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
        ];
      };
      sba_certification_results: {
        Row: {
          cage_code: string | null;
          certification_program: string;
          certification_status: string;
          confidence: number;
          created_at: string;
          evidence_type: string;
          expiration_date: string | null;
          id: string;
          needs_review: boolean;
          offer_id: string;
          run_id: string;
          source_url: string;
          uei: string;
        };
        Insert: {
          cage_code?: string | null;
          certification_program: string;
          certification_status: string;
          confidence?: number;
          created_at?: string;
          evidence_type: string;
          expiration_date?: string | null;
          id?: string;
          needs_review?: boolean;
          offer_id: string;
          run_id: string;
          source_url: string;
          uei: string;
        };
        Update: {
          cage_code?: string | null;
          certification_program?: string;
          certification_status?: string;
          confidence?: number;
          created_at?: string;
          evidence_type?: string;
          expiration_date?: string | null;
          id?: string;
          needs_review?: boolean;
          offer_id?: string;
          run_id?: string;
          source_url?: string;
          uei?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sba_certification_results_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sba_certification_results_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "automation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      market_validation_results: {
        Row: {
          client_lcat: string | null;
          contract_number: string | null;
          contractor: string | null;
          created_at: string;
          gsa_net_price: string | null;
          id: string;
          labor_category: string;
          needs_review: boolean;
          offer_id: string;
          run_id: string;
          sin: string;
          source_url: string;
          unit_of_issue: string | null;
        };
        Insert: {
          client_lcat?: string | null;
          contract_number?: string | null;
          contractor?: string | null;
          created_at?: string;
          gsa_net_price?: string | null;
          id?: string;
          labor_category: string;
          needs_review?: boolean;
          offer_id: string;
          run_id: string;
          sin: string;
          source_url: string;
          unit_of_issue?: string | null;
        };
        Update: {
          client_lcat?: string | null;
          contract_number?: string | null;
          contractor?: string | null;
          created_at?: string;
          gsa_net_price?: string | null;
          id?: string;
          labor_category?: string;
          needs_review?: boolean;
          offer_id?: string;
          run_id?: string;
          sin?: string;
          source_url?: string;
          unit_of_issue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_validation_results_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_validation_results_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "automation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      sca_lcat_matches: {
        Row: {
          client_description: string | null;
          client_lcat: string;
          confidence: number | null;
          created_at: string;
          id: string;
          match_status: string;
          needs_review: boolean;
          offer_id: string;
          rationale: string | null;
          run_id: string;
          sca_code: string | null;
          sca_family: string | null;
          sca_title: string | null;
          source_url: string | null;
          wage_determination_table: string | null;
        };
        Insert: {
          client_description?: string | null;
          client_lcat: string;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          match_status: string;
          needs_review?: boolean;
          offer_id: string;
          rationale?: string | null;
          run_id: string;
          sca_code?: string | null;
          sca_family?: string | null;
          sca_title?: string | null;
          source_url?: string | null;
          wage_determination_table?: string | null;
        };
        Update: {
          client_description?: string | null;
          client_lcat?: string;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          match_status?: string;
          needs_review?: boolean;
          offer_id?: string;
          rationale?: string | null;
          run_id?: string;
          sca_code?: string | null;
          sca_family?: string | null;
          sca_title?: string | null;
          source_url?: string | null;
          wage_determination_table?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sca_lcat_matches_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sca_lcat_matches_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "automation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_workbook_outputs: {
        Row: {
          created_at: string;
          filename: string;
          id: string;
          needs_review: boolean;
          offer_id: string;
          output_summary: Json;
          row_count: number;
          run_id: string;
          source_template_url: string | null;
          template_kind: string;
          template_refresh: string;
        };
        Insert: {
          created_at?: string;
          filename: string;
          id?: string;
          needs_review?: boolean;
          offer_id: string;
          output_summary?: Json;
          row_count?: number;
          run_id: string;
          source_template_url?: string | null;
          template_kind: string;
          template_refresh: string;
        };
        Update: {
          created_at?: string;
          filename?: string;
          id?: string;
          needs_review?: boolean;
          offer_id?: string;
          output_summary?: Json;
          row_count?: number;
          run_id?: string;
          source_template_url?: string | null;
          template_kind?: string;
          template_refresh?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_workbook_outputs_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_workbook_outputs_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "automation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      can_access_offer: {
        Args: {
          _offer_id: string;
        };
        Returns: boolean;
      };
      can_access_organization: {
        Args: {
          _organization_id: string;
        };
        Returns: boolean;
      };
      create_offer_workspace: {
        Args: {
          p_client_email?: string | null;
          p_offer_name: string;
          p_offer_type?: Database["public"]["Enums"]["offer_type"];
          p_organization_id?: string | null;
          p_organization_name?: string | null;
          p_solicitation_number?: string | null;
        };
        Returns: {
          offer_id: string;
          organization_id: string;
        }[];
      };
      log_offer_activity: {
        Args: {
          p_action: string;
          p_module: string;
          p_offer_id: string;
          p_target?: string | null;
          p_visibility?: Database["public"]["Enums"]["offer_activity_visibility"];
        };
        Returns: string;
      };
      is_offer_member: {
        Args: {
          _offer_id: string;
        };
        Returns: boolean;
      };
      role_for_email: {
        Args: {
          _email: string;
        };
        Returns: Database["public"]["Enums"]["app_role"];
      };
    };
    Enums: {
      app_role: "admin" | "client";
      automation_module:
        | "sba_status"
        | "market_validation"
        | "sca_lcat_confirmation"
        | "pricing_workbook";
      automation_run_status: "running" | "completed" | "failed" | "needs_review";
      offer_activity_visibility: "admin" | "client";
      offer_member_role:
        | "admin_lead"
        | "reviewer"
        | "client_contributor"
        | "authorized_negotiator"
        | "viewer";
      offer_stage:
        | "intake"
        | "readiness"
        | "automation"
        | "review"
        | "submission"
        | "post_submission";
      offer_status: "active" | "blocked" | "submitted" | "awarded" | "archived";
      offer_type: "gsa_mas" | "va_fss" | "gwac_rfp" | "custom_solicitation";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client"],
      automation_module: [
        "sba_status",
        "market_validation",
        "sca_lcat_confirmation",
        "pricing_workbook",
      ],
      automation_run_status: ["running", "completed", "failed", "needs_review"],
      offer_activity_visibility: ["admin", "client"],
      offer_member_role: [
        "admin_lead",
        "reviewer",
        "client_contributor",
        "authorized_negotiator",
        "viewer",
      ],
      offer_stage: ["intake", "readiness", "automation", "review", "submission", "post_submission"],
      offer_status: ["active", "blocked", "submitted", "awarded", "archived"],
      offer_type: ["gsa_mas", "va_fss", "gwac_rfp", "custom_solicitation"],
    },
  },
} as const;
