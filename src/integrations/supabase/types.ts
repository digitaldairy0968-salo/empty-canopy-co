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
      activation_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          dairy_id: string | null
          id: string
          is_used: boolean | null
          used_at: string | null
          validity_days: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          dairy_id?: string | null
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          validity_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          dairy_id?: string | null
          id?: string
          is_used?: boolean | null
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
          created_at: string
          dairy_id: string
          id: string
          message: string
        }
        Insert: {
          created_at?: string
          dairy_id: string
          id?: string
          message: string
        }
        Update: {
          created_at?: string
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
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dairy_features: {
        Row: {
          created_at: string
          dairy_id: string
          feature_key: string
          id: string
          is_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dairy_id: string
          feature_key: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dairy_id?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
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
          requested_by: string | null
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
          requested_by?: string | null
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
          requested_by?: string | null
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
          base_fat_rate: number | null
          base_snf: number | null
          created_at: string
          dairy_id: string
          fat_max: number | null
          fat_min: number | null
          fat_step: number | null
          id: string
          is_enabled: boolean | null
          snf_deduction_per_point: number | null
          snf_max: number | null
          snf_min: number | null
          updated_at: string
        }
        Insert: {
          base_fat_rate?: number | null
          base_snf?: number | null
          created_at?: string
          dairy_id: string
          fat_max?: number | null
          fat_min?: number | null
          fat_step?: number | null
          id?: string
          is_enabled?: boolean | null
          snf_deduction_per_point?: number | null
          snf_max?: number | null
          snf_min?: number | null
          updated_at?: string
        }
        Update: {
          base_fat_rate?: number | null
          base_snf?: number | null
          created_at?: string
          dairy_id?: string
          fat_max?: number | null
          fat_min?: number | null
          fat_step?: number | null
          id?: string
          is_enabled?: boolean | null
          snf_deduction_per_point?: number | null
          snf_max?: number | null
          snf_min?: number | null
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
          created_at: string
          dairy_id: string
          date: string
          fat: number | null
          id: string
          lr: number | null
          price: number | null
          quantity: number | null
          snf: number | null
          supplier_id: string
          time_of_day: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dairy_id: string
          date: string
          fat?: number | null
          id?: string
          lr?: number | null
          price?: number | null
          quantity?: number | null
          snf?: number | null
          supplier_id: string
          time_of_day: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dairy_id?: string
          date?: string
          fat?: number | null
          id?: string
          lr?: number | null
          price?: number | null
          quantity?: number | null
          snf?: number | null
          supplier_id?: string
          time_of_day?: string
          updated_at?: string
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
      notifications: {
        Row: {
          created_at: string
          dairy_id: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          supplier_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dairy_id: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          supplier_id: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dairy_id?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          supplier_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_supplier_id_fkey"
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
          predict_milk_enabled: boolean | null
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
          predict_milk_enabled?: boolean | null
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
          predict_milk_enabled?: boolean | null
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
          balance_after: number | null
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
          balance_after?: number | null
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
          balance_after?: number | null
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
        Relationships: [
          {
            foreignKeyName: "payment_history_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: false
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          validity_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          validity_days?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_settings: {
        Row: {
          calculation_method: string | null
          created_at: string
          dairy_id: string
          id: string
          liter_rate: number | null
          rate_type: string
          rate_value: number
          show_calculations_to_suppliers: boolean | null
          updated_at: string
        }
        Insert: {
          calculation_method?: string | null
          created_at?: string
          dairy_id: string
          id?: string
          liter_rate?: number | null
          rate_type?: string
          rate_value?: number
          show_calculations_to_suppliers?: boolean | null
          updated_at?: string
        }
        Update: {
          calculation_method?: string | null
          created_at?: string
          dairy_id?: string
          id?: string
          liter_rate?: number | null
          rate_type?: string
          rate_value?: number
          show_calculations_to_suppliers?: boolean | null
          updated_at?: string
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
          reward_days: number | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_days?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_days?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      subscription_settings: {
        Row: {
          admin_phone: string
          auth_page_image_url: string | null
          created_at: string
          default_validity_days: number | null
          demo_days: number
          id: string
          monthly_price: number
          qr_code_url: string | null
          updated_at: string
          upi_id: string
        }
        Insert: {
          admin_phone?: string
          auth_page_image_url?: string | null
          created_at?: string
          default_validity_days?: number | null
          demo_days?: number
          id?: string
          monthly_price?: number
          qr_code_url?: string | null
          updated_at?: string
          upi_id?: string
        }
        Update: {
          admin_phone?: string
          auth_page_image_url?: string | null
          created_at?: string
          default_validity_days?: number | null
          demo_days?: number
          id?: string
          monthly_price?: number
          qr_code_url?: string | null
          updated_at?: string
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
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          dairy_id: string
          expires_at: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dairy_id: string
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dairy_id?: string
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_dairy_id_fkey"
            columns: ["dairy_id"]
            isOneToOne: true
            referencedRelation: "dairies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          animal_name: string | null
          animal_type: string
          can_see_calculations: boolean | null
          code: string | null
          created_at: string
          dairy_id: string
          id: string
          name: string
          pending_balance: number | null
          phone: string
          updated_at: string
          user_id: string | null
          village_name: string | null
        }
        Insert: {
          address?: string | null
          animal_name?: string | null
          animal_type?: string
          can_see_calculations?: boolean | null
          code?: string | null
          created_at?: string
          dairy_id: string
          id?: string
          name: string
          pending_balance?: number | null
          phone?: string
          updated_at?: string
          user_id?: string | null
          village_name?: string | null
        }
        Update: {
          address?: string | null
          animal_name?: string | null
          animal_type?: string
          can_see_calculations?: boolean | null
          code?: string | null
          created_at?: string
          dairy_id?: string
          id?: string
          name?: string
          pending_balance?: number | null
          phone?: string
          updated_at?: string
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
      variety_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          price: number
          validity_days: number
          variety_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          validity_days?: number
          variety_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
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
      activate_demo_subscription: {
        Args: { _dairy_id: string }
        Returns: boolean
      }
      activate_subscription_code: {
        Args: { _code: string; _dairy_id: string }
        Returns: boolean
      }
      apply_referral_reward: {
        Args: { _referred_user_id: string }
        Returns: boolean
      }
      check_dairy_code_exists: {
        Args: { dairy_code: string }
        Returns: boolean
      }
      get_dairy_by_code: {
        Args: { dairy_code: string }
        Returns: {
          code: string
          id: string
          name: string
          owner_id: string
        }[]
      }
      get_supplier_dairy_id: { Args: { _user_id: string }; Returns: string }
      get_user_dairy_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      link_supplier_to_dairy_by_code: {
        Args: { _dairy_code: string }
        Returns: {
          error_code: string
          linked: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "owner" | "supplier"
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
      app_role: ["admin", "owner", "supplier"],
    },
  },
} as const
