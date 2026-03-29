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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          dairy_id: string | null
          id: string
          is_used: boolean
          used_at: string | null
          validity_days: number
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          dairy_id?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          validity_days?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          dairy_id?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "activation_codes_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string | null
          dairy_id: string
          id: string
          message: string
        }
        Insert: {
          created_at?: string | null
          dairy_id: string
          id?: string
          message: string
        }
        Update: {
          created_at?: string | null
          dairy_id?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      dairies: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      dairy_features: {
        Row: {
          created_at: string
          dairy_id: string
          feature_key: string
          id: string
          is_enabled: boolean
        }
        Insert: {
          created_at?: string
          dairy_id: string
          feature_key: string
          id?: string
          is_enabled?: boolean
        }
        Update: {
          created_at?: string
          dairy_id?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dairy_features_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_edit_requests: {
        Row: {
          changes: Json
          created_at: string
          dairy_id: string
          entry_id: string
          id: string
          reason: string | null
          requested_by: string
          responded_at: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          dairy_id: string
          entry_id: string
          id?: string
          reason?: string | null
          requested_by: string
          responded_at?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          dairy_id?: string
          entry_id?: string
          id?: string
          reason?: string | null
          requested_by?: string
          responded_at?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_edit_requests_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_edit_requests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "milk_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_edit_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fat_snf_rate_settings: {
        Row: {
          base_fat_rate: number
          base_snf: number
          created_at: string
          dairy_id: string
          fat_max: number
          fat_min: number
          fat_step: number
          id: string
          is_enabled: boolean
          snf_deduction_per_point: number
          snf_max: number
          snf_min: number
          updated_at: string
        }
        Insert: {
          base_fat_rate?: number
          base_snf?: number
          created_at?: string
          dairy_id: string
          fat_max?: number
          fat_min?: number
          fat_step?: number
          id?: string
          is_enabled?: boolean
          snf_deduction_per_point?: number
          snf_max?: number
          snf_min?: number
          updated_at?: string
        }
        Update: {
          base_fat_rate?: number
          base_snf?: number
          created_at?: string
          dairy_id?: string
          fat_max?: number
          fat_min?: number
          fat_step?: number
          id?: string
          is_enabled?: boolean
          snf_deduction_per_point?: number
          snf_max?: number
          snf_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fat_snf_rate_settings_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: true
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_entries: {
        Row: {
          created_at: string | null
          dairy_id: string
          date: string
          fat: number | null
          id: string
          lr: number | null
          quantity: number | null
          snf: number | null
          supplier_id: string
          time_of_day: string
        }
        Insert: {
          created_at?: string | null
          dairy_id: string
          date: string
          fat?: number | null
          id?: string
          lr?: number | null
          quantity?: number | null
          snf?: number | null
          supplier_id: string
          time_of_day: string
        }
        Update: {
          created_at?: string | null
          dairy_id?: string
          date?: string
          fat?: number | null
          id?: string
          lr?: number | null
          quantity?: number | null
          snf?: number | null
          supplier_id?: string
          time_of_day?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_entries_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_settings: {
        Row: {
          auto_print_enabled: boolean | null
          bhugtan_output_type: string | null
          bluetooth_fat_machine_connected: boolean | null
          bluetooth_printer_connected: boolean | null
          calculation_system: string | null
          code_direction: string | null
          created_at: string
          dairy_id: string
          dairy_name_for_pdf: string | null
          id: string
          milk_buying_basis: string | null
          onboarding_completed: boolean | null
          prefill_enabled: boolean | null
          prefill_fat: number | null
          prefill_lr: number | null
          prefill_snf: number | null
          show_rakam_to_customers: boolean | null
          updated_at: string
          uses_printer: boolean | null
        }
        Insert: {
          auto_print_enabled?: boolean | null
          bhugtan_output_type?: string | null
          bluetooth_fat_machine_connected?: boolean | null
          bluetooth_printer_connected?: boolean | null
          calculation_system?: string | null
          code_direction?: string | null
          created_at?: string
          dairy_id: string
          dairy_name_for_pdf?: string | null
          id?: string
          milk_buying_basis?: string | null
          onboarding_completed?: boolean | null
          prefill_enabled?: boolean | null
          prefill_fat?: number | null
          prefill_lr?: number | null
          prefill_snf?: number | null
          show_rakam_to_customers?: boolean | null
          updated_at?: string
          uses_printer?: boolean | null
        }
        Update: {
          auto_print_enabled?: boolean | null
          bhugtan_output_type?: string | null
          bluetooth_fat_machine_connected?: boolean | null
          bluetooth_printer_connected?: boolean | null
          calculation_system?: string | null
          code_direction?: string | null
          created_at?: string
          dairy_id?: string
          dairy_name_for_pdf?: string | null
          id?: string
          milk_buying_basis?: string | null
          onboarding_completed?: boolean | null
          prefill_enabled?: boolean | null
          prefill_fat?: number | null
          prefill_lr?: number | null
          prefill_snf?: number | null
          show_rakam_to_customers?: boolean | null
          updated_at?: string
          uses_printer?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_settings_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: true
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_added: number | null
          amount_paid: number | null
          balance_after: number
          confirmed_at: string | null
          created_at: string
          dairy_id: string
          date_range_end: string | null
          date_range_start: string | null
          id: string
          notes: string | null
          supplier_confirmed: boolean | null
          supplier_id: string
          transaction_date: string
        }
        Insert: {
          amount_added?: number | null
          amount_paid?: number | null
          balance_after?: number
          confirmed_at?: string | null
          created_at?: string
          dairy_id: string
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          notes?: string | null
          supplier_confirmed?: boolean | null
          supplier_id: string
          transaction_date?: string
        }
        Update: {
          amount_added?: number | null
          amount_paid?: number | null
          balance_after?: number
          confirmed_at?: string | null
          created_at?: string
          dairy_id?: string
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          notes?: string | null
          supplier_confirmed?: boolean | null
          supplier_id?: string
          transaction_date?: string
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string
          referral_code: string | null
          referred_by_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone: string
          referral_code?: string | null
          referred_by_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          referral_code?: string | null
          referred_by_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_settings: {
        Row: {
          calculation_method: string
          dairy_id: string
          id: string
          liter_rate: number
          rate_type: string
          rate_value: number
          show_calculations_to_suppliers: boolean
          updated_at: string | null
        }
        Insert: {
          calculation_method?: string
          dairy_id: string
          id?: string
          liter_rate?: number
          rate_type?: string
          rate_value?: number
          show_calculations_to_suppliers?: boolean
          updated_at?: string | null
        }
        Update: {
          calculation_method?: string
          dairy_id?: string
          id?: string
          liter_rate?: number
          rate_type?: string
          rate_value?: number
          show_calculations_to_suppliers?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_settings_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: true
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_applied: boolean
          reward_applied_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_applied?: boolean
          reward_applied_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_applied?: boolean
          reward_applied_at?: string | null
        }
        Relationships: []
      }
      subscription_settings: {
        Row: {
          admin_phone: string
          default_validity_days: number
          id: string
          monthly_price: number
          qr_code_url: string | null
          updated_at: string | null
          upi_id: string
        }
        Insert: {
          admin_phone?: string
          default_validity_days?: number
          id?: string
          monthly_price?: number
          qr_code_url?: string | null
          updated_at?: string | null
          upi_id?: string
        }
        Update: {
          admin_phone?: string
          default_validity_days?: number
          id?: string
          monthly_price?: number
          qr_code_url?: string | null
          updated_at?: string | null
          upi_id?: string
        }
        Relationships: []
      }
      subscription_varieties: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activation_code_id: string | null
          created_at: string | null
          dairy_id: string
          expires_at: string | null
          id: string
          started_at: string | null
          status: string
          variety_id: string | null
        }
        Insert: {
          activation_code_id?: string | null
          created_at?: string | null
          dairy_id: string
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          variety_id?: string | null
        }
        Update: {
          activation_code_id?: string | null
          created_at?: string | null
          dairy_id?: string
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_activation_code_id_fkey"
            columns: ["activation_code_id"]
            isOneToOne: false
            referencedRelation: "activation_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: true
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "subscription_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          animal_type: string | null
          can_see_calculations: boolean
          code: string
          created_at: string | null
          dairy_id: string
          id: string
          name: string
          pending_balance: number
          phone: string
          user_id: string | null
          village_name: string | null
        }
        Insert: {
          address?: string | null
          animal_type?: string | null
          can_see_calculations?: boolean
          code: string
          created_at?: string | null
          dairy_id: string
          id?: string
          name: string
          pending_balance?: number
          phone: string
          user_id?: string | null
          village_name?: string | null
        }
        Update: {
          address?: string | null
          animal_type?: string | null
          can_see_calculations?: boolean
          code?: string
          created_at?: string | null
          dairy_id?: string
          id?: string
          name?: string
          pending_balance?: number
          phone?: string
          user_id?: string | null
          village_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
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
      variety_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
          validity_days: number
          variety_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
          validity_days?: number
          variety_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          validity_days?: number
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variety_plans_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "subscription_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_subscription_code: {
        Args: { _code: string; _dairy_id: string }
        Returns: {
          expires_at: string
          started_at: string
          status: string
        }[]
      }
      apply_referral_reward: {
        Args: { _referred_user_id: string }
        Returns: boolean
      }
      check_dairy_code_exists: {
        Args: { dairy_code: string }
        Returns: boolean
      }
      generate_referral_code: { Args: never; Returns: string }
      get_dairy_by_code: {
        Args: { dairy_code: string }
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      get_user_dairy_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dairy_owner: {
        Args: { _dairy_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "supplier" | "admin"
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
      app_role: ["owner", "supplier", "admin"],
    },
  },
} as const
