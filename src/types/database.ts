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
  tripsplit: {
    Tables: {
      budget_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          planned_amount: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          planned_amount: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          planned_amount?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_category_fkey"
            columns: ["category_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "budget_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "budget_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          trip_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          trip_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          decimals: number
          name: string
          symbol: string
        }
        Insert: {
          code: string
          decimals: number
          name: string
          symbol: string
        }
        Update: {
          code?: string
          decimals?: number
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          split_type: Database["tripsplit"]["Enums"]["split_type"]
          user_id: string
          value: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          expense_id: string
          id?: string
          split_type: Database["tripsplit"]["Enums"]["split_type"]
          user_id: string
          value?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          split_type?: Database["tripsplit"]["Enums"]["split_type"]
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          converted_amount: number
          created_at: string
          created_by: string | null
          currency: string
          description: string
          exchange_rate: number
          expense_date: string
          id: string
          notes: string | null
          paid_by: string
          participant_ids: string[]
          receipt_url: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          converted_amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          paid_by: string
          participant_ids?: string[]
          receipt_url?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          converted_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          paid_by?: string
          participant_ids?: string[]
          receipt_url?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_fkey"
            columns: ["category_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          preferred_currency: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          preferred_currency?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          preferred_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_currency_fkey"
            columns: ["preferred_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          from_user_id: string
          id: string
          note: string | null
          payment_method: Database["tripsplit"]["Enums"]["payment_method"]
          settlement_date: string
          to_user_id: string
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          from_user_id: string
          id?: string
          note?: string | null
          payment_method?: Database["tripsplit"]["Enums"]["payment_method"]
          settlement_date?: string
          to_user_id: string
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_user_id?: string
          id?: string
          note?: string | null
          payment_method?: Database["tripsplit"]["Enums"]["payment_method"]
          settlement_date?: string
          to_user_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "settlements_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          invited_name: string | null
          status: Database["tripsplit"]["Enums"]["invitation_status"]
          token: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email: string
          invited_name?: string | null
          status?: Database["tripsplit"]["Enums"]["invitation_status"]
          token?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          invited_name?: string | null
          status?: Database["tripsplit"]["Enums"]["invitation_status"]
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["tripsplit"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["tripsplit"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["tripsplit"]["Enums"]["member_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget: number
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          destination: string | null
          end_date: string
          id: string
          name: string
          owner_id: string
          start_date: string
          status: Database["tripsplit"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          budget?: number
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination?: string | null
          end_date: string
          id?: string
          name: string
          owner_id?: string
          start_date: string
          status?: Database["tripsplit"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          budget?: number
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination?: string | null
          end_date?: string
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
          status?: Database["tripsplit"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trip_member_balances: {
        Row: {
          net: number | null
          paid: number | null
          settlements_paid: number | null
          settlements_received: number | null
          share: number | null
          trip_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_totals: {
        Row: {
          expense_count: number | null
          total_spent: number | null
          trip_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string }
      accept_invitation_link: { Args: { p_token: string }; Returns: string }
      change_trip_currency: {
        Args: { p_currency: string; p_rate: number; p_trip_id: string }
        Returns: undefined
      }
      decline_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      decline_invitation_link: { Args: { p_token: string }; Returns: undefined }
      ensure_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          preferred_currency: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          already_member: boolean
          destination: string
          end_date: string
          invited_by_avatar_url: string
          invited_by_name: string
          invited_name: string
          start_date: string
          status: string
          trip_id: string
          trip_name: string
        }[]
      }
      get_my_invitations: {
        Args: never
        Returns: {
          created_at: string
          destination: string
          end_date: string
          expires_at: string
          id: string
          invited_by_avatar_url: string
          invited_by_name: string
          start_date: string
          trip_id: string
          trip_name: string
        }[]
      }
      save_expense: {
        Args: { p_expense: Json; p_splits: Json }
        Returns: string
      }
    }
    Enums: {
      invitation_status: "pending" | "accepted" | "declined" | "expired"
      member_role: "owner" | "member"
      payment_method: "cash" | "bank_transfer" | "gcash" | "paypal" | "other"
      split_type: "equal" | "custom" | "percentage" | "shares"
      trip_status: "upcoming" | "active" | "completed"
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
  tripsplit: {
    Enums: {
      invitation_status: ["pending", "accepted", "declined", "expired"],
      member_role: ["owner", "member"],
      payment_method: ["cash", "bank_transfer", "gcash", "paypal", "other"],
      split_type: ["equal", "custom", "percentage", "shares"],
      trip_status: ["upcoming", "active", "completed"],
    },
  },
} as const
