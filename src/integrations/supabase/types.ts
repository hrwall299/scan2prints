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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      order_events: {
        Row: {
          created_at: string
          id: string
          note: string
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          color_page_list: string
          color_pages: number
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          order_id: string
          page_count: number
          size_bytes: number
          storage_path: string
        }
        Insert: {
          color_page_list?: string
          color_pages?: number
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type: string
          order_id: string
          page_count?: number
          size_bytes: number
          storage_path: string
        }
        Update: {
          color_page_list?: string
          color_pages?: number
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          order_id?: string
          page_count?: number
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          color_mode: string
          color_pages: number
          completed_at: string | null
          copies: number
          created_at: string
          customer_name: string
          customer_phone: string
          estimated_price: number
          files_deleted_at: string | null
          id: string
          layout: string
          mode: string
          notes: string
          order_number: number
          page_count: number
          page_size: string
          paper_type: string
          queue_position: number | null
          reject_reason: string
          rejected_at: string | null
          sides: string
          status: string
          tracking_token: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          color_mode: string
          color_pages?: number
          completed_at?: string | null
          copies: number
          created_at?: string
          customer_name: string
          customer_phone?: string
          estimated_price?: number
          files_deleted_at?: string | null
          id?: string
          layout?: string
          mode: string
          notes?: string
          order_number?: number
          page_count?: number
          page_size?: string
          paper_type?: string
          queue_position?: number | null
          reject_reason?: string
          rejected_at?: string | null
          sides?: string
          status?: string
          tracking_token: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          color_mode?: string
          color_pages?: number
          completed_at?: string | null
          copies?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          estimated_price?: number
          files_deleted_at?: string | null
          id?: string
          layout?: string
          mode?: string
          notes?: string
          order_number?: number
          page_count?: number
          page_size?: string
          paper_type?: string
          queue_position?: number | null
          reject_reason?: string
          rejected_at?: string | null
          sides?: string
          status?: string
          tracking_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      printers: {
        Row: {
          connection: string
          default_paper: string
          duplex: boolean
          id: string
          kind: string
          model: string
          name: string
          quality: string
          status: string
          updated_at: string
        }
        Insert: {
          connection?: string
          default_paper?: string
          duplex?: boolean
          id?: string
          kind: string
          model?: string
          name: string
          quality?: string
          status?: string
          updated_at?: string
        }
        Update: {
          connection?: string
          default_paper?: string
          duplex?: boolean
          id?: string
          kind?: string
          model?: string
          name?: string
          quality?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          a3_multiplier: number
          bw_price: number
          cleanup_hours: number
          color_price: number
          currency: string
          duplex_discount: number
          glossy_surcharge: number
          id: number
          max_file_mb: number
          shop_name: string
          updated_at: string
        }
        Insert: {
          a3_multiplier?: number
          bw_price?: number
          cleanup_hours?: number
          color_price?: number
          currency?: string
          duplex_discount?: number
          glossy_surcharge?: number
          id?: number
          max_file_mb?: number
          shop_name?: string
          updated_at?: string
        }
        Update: {
          a3_multiplier?: number
          bw_price?: number
          cleanup_hours?: number
          color_price?: number
          currency?: string
          duplex_discount?: number
          glossy_surcharge?: number
          id?: number
          max_file_mb?: number
          shop_name?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
