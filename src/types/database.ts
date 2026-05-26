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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_balance_snapshots: {
        Row: {
          account_id: string
          balance_cents: number
          captured_at: string
          household_id: string
          id: string
          snapshot_date: string
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          balance_cents: number
          captured_at?: string
          household_id: string
          id?: string
          snapshot_date: string
          source?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          balance_cents?: number
          captured_at?: string
          household_id?: string
          id?: string
          snapshot_date?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_balance_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          balance_cents: number
          created_at: string
          currency: string
          household_id: string
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          currency: string
          household_id: string
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          currency?: string
          household_id?: string
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color_hint: string | null
          created_at: string
          household_id: string
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          monthly_limit_cents: number | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_hint?: string | null
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          monthly_limit_cents?: number | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_hint?: string | null
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          monthly_limit_cents?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          closed_at: string | null
          created_at: string
          currency: string
          household_id: string
          id: string
          notes: string | null
          original_amount_cents: number
          priority: number
          remaining_amount_cents: number
          status: string
          target_installments: number | null
          target_quit_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          currency: string
          household_id: string
          id?: string
          notes?: string | null
          original_amount_cents: number
          priority?: number
          remaining_amount_cents: number
          status?: string
          target_installments?: number | null
          target_quit_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          currency?: string
          household_id?: string
          id?: string
          notes?: string | null
          original_amount_cents?: number
          priority?: number
          remaining_amount_cents?: number
          status?: string
          target_installments?: number | null
          target_quit_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      envelopes: {
        Row: {
          created_at: string
          currency: string
          current_cents: number
          household_id: string
          id: string
          name: string
          sort_order: number
          target_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          current_cents?: number
          household_id: string
          id?: string
          name: string
          sort_order?: number
          target_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_cents?: number
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          target_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "envelopes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates_cache: {
        Row: {
          base: string
          fetched_at: string
          id: string
          quote: string
          rate: number
          rate_date: string
        }
        Insert: {
          base: string
          fetched_at?: string
          id?: string
          quote: string
          rate: number
          rate_date: string
        }
        Update: {
          base?: string
          fetched_at?: string
          id?: string
          quote?: string
          rate?: number
          rate_date?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      installment_plans: {
        Row: {
          account_id: string | null
          category_id: string | null
          created_at: string
          currency: string
          first_due_date: string
          frequency_months: number
          household_id: string
          id: string
          notes: string | null
          title: string
          total_amount_cents: number
          total_installments: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string
          currency: string
          first_due_date: string
          frequency_months?: number
          household_id: string
          id?: string
          notes?: string | null
          title: string
          total_amount_cents: number
          total_installments: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          first_due_date?: string
          frequency_months?: number
          household_id?: string
          id?: string
          notes?: string | null
          title?: string
          total_amount_cents?: number
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          preferred_display_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id: string
          preferred_display_currency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          preferred_display_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          account_id: string | null
          active_from: string
          active_until: string | null
          amount_cents: number
          category_id: string | null
          created_at: string
          currency: string
          day_of_month: number
          direction: string
          frequency: string
          household_id: string
          id: string
          is_paused: boolean
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active_from?: string
          active_until?: string | null
          amount_cents: number
          category_id?: string | null
          created_at?: string
          currency: string
          day_of_month: number
          direction: string
          frequency?: string
          household_id: string
          id?: string
          is_paused?: boolean
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active_from?: string
          active_until?: string | null
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          day_of_month?: number
          direction?: string
          frequency?: string
          household_id?: string
          id?: string
          is_paused?: boolean
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          created_at: string
          currency: string
          description: string
          direction: string
          household_id: string
          id: string
          installment_number: number | null
          notes: string | null
          occurred_on: string
          paid_on: string | null
          profile_id: string
          source_debt_id: string | null
          source_installment_plan_id: string | null
          source_recurring_rule_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          created_at?: string
          currency: string
          description: string
          direction: string
          household_id: string
          id?: string
          installment_number?: number | null
          notes?: string | null
          occurred_on: string
          paid_on?: string | null
          profile_id: string
          source_debt_id?: string | null
          source_installment_plan_id?: string | null
          source_recurring_rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: string
          household_id?: string
          id?: string
          installment_number?: number | null
          notes?: string | null
          occurred_on?: string
          paid_on?: string | null
          profile_id?: string
          source_debt_id?: string | null
          source_installment_plan_id?: string | null
          source_recurring_rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_debt_id_fkey"
            columns: ["source_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_installment_plan_id_fkey"
            columns: ["source_installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_recurring_rule_id_fkey"
            columns: ["source_recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_account_totals: {
        Row: {
          balance_cents: number | null
          currency: string | null
          household_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      v_month_summary: {
        Row: {
          currency: string | null
          expense_overdue_cents: number | null
          expense_paid_cents: number | null
          expense_pending_cents: number | null
          household_id: string | null
          income_paid_cents: number | null
          income_pending_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_household_id: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
