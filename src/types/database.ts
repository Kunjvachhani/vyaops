// Auto-generated — run: npx supabase gen types ts --local > src/types/database.ts
// This scaffold reflects the current migration state. Regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          gstin: string | null
          address: string | null
          city: string
          state: string
          phone: string
          email: string | null
          industry_config: string
          tier: string
          tier_valid_until: string | null
          billing_status: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          whatsapp_phone: string | null
          whatsapp_connected: boolean
          auto_mode_enabled: boolean
          language_preference: string
          timezone: string
          onboarded_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          gstin?: string | null
          address?: string | null
          city: string
          state?: string
          phone: string
          email?: string | null
          industry_config?: string
          tier?: string
          tier_valid_until?: string | null
          billing_status?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          whatsapp_phone?: string | null
          whatsapp_connected?: boolean
          auto_mode_enabled?: boolean
          language_preference?: string
          timezone?: string
          onboarded_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          gstin?: string | null
          address?: string | null
          city?: string
          state?: string
          phone?: string
          email?: string | null
          industry_config?: string
          tier?: string
          tier_valid_until?: string | null
          billing_status?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          whatsapp_phone?: string | null
          whatsapp_connected?: boolean
          auto_mode_enabled?: boolean
          language_preference?: string
          timezone?: string
          onboarded_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          organization_id: string
          email: string | null
          phone: string | null
          full_name: string
          role: string
          avatar_url: string | null
          is_active: boolean
          last_login_at: string | null
          supabase_auth_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          email?: string | null
          phone?: string | null
          full_name: string
          role?: string
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          supabase_auth_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string | null
          phone?: string | null
          full_name?: string
          role?: string
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          supabase_auth_id?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "users_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          name: string
          company_name: string | null
          aliases: string[]
          phone: string | null
          email: string | null
          gstin: string | null
          address: string | null
          payment_terms_days: number
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          company_name?: string | null
          aliases?: string[]
          phone?: string | null
          email?: string | null
          gstin?: string | null
          address?: string | null
          payment_terms_days?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          company_name?: string | null
          aliases?: string[]
          phone?: string | null
          email?: string | null
          gstin?: string | null
          address?: string | null
          payment_terms_days?: number
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "customers_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      vendors: {
        Row: {
          id: string
          organization_id: string
          name: string
          company_name: string | null
          aliases: string[]
          phone: string | null
          email: string | null
          gstin: string | null
          address: string | null
          materials_supplied: string[] | null
          payment_terms_days: number
          rating: number
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          company_name?: string | null
          aliases?: string[]
          phone?: string | null
          email?: string | null
          gstin?: string | null
          address?: string | null
          materials_supplied?: string[] | null
          payment_terms_days?: number
          rating?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          company_name?: string | null
          aliases?: string[]
          phone?: string | null
          email?: string | null
          gstin?: string | null
          address?: string | null
          materials_supplied?: string[] | null
          payment_terms_days?: number
          rating?: number
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "vendors_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      products: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string | null
          aliases: string[]
          category: string | null
          unit: string
          unit_price_paise: number
          hsn_code: string | null
          raw_materials: Json
          reorder_level: number
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code?: string | null
          aliases?: string[]
          category?: string | null
          unit?: string
          unit_price_paise?: number
          hsn_code?: string | null
          raw_materials?: Json
          reorder_level?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string | null
          aliases?: string[]
          category?: string | null
          unit?: string
          unit_price_paise?: number
          hsn_code?: string | null
          raw_materials?: Json
          reorder_level?: number
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "products_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      orders: {
        Row: {
          id: string
          organization_id: string
          order_number: string
          customer_id: string
          product_id: string
          quantity: number
          unit_price_paise: number
          total_amount_paise: number
          status: string
          delivery_date: string | null
          quantity_produced: number
          quantity_dispatched: number
          source: string
          source_message_id: string | null
          idempotency_key: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          order_number: string
          customer_id: string
          product_id: string
          quantity: number
          unit_price_paise: number
          total_amount_paise: number
          status?: string
          delivery_date?: string | null
          quantity_produced?: number
          quantity_dispatched?: number
          source?: string
          source_message_id?: string | null
          idempotency_key?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          order_number?: string
          customer_id?: string
          product_id?: string
          quantity?: number
          unit_price_paise?: number
          total_amount_paise?: number
          status?: string
          delivery_date?: string | null
          quantity_produced?: number
          quantity_dispatched?: number
          source?: string
          source_message_id?: string | null
          idempotency_key?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "orders_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          invoice_number: string
          order_id: string
          customer_id: string
          subtotal_paise: number
          tax_rate: number
          tax_amount_paise: number
          total_amount_paise: number
          status: string
          due_date: string
          paid_amount_paise: number
          paid_date: string | null
          payment_method: string | null
          pdf_url: string | null
          sent_via_whatsapp: boolean
          sent_at: string | null
          reminder_count: number
          last_reminder_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_number: string
          order_id: string
          customer_id: string
          subtotal_paise: number
          tax_rate?: number
          tax_amount_paise: number
          total_amount_paise: number
          status?: string
          due_date: string
          paid_amount_paise?: number
          paid_date?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          sent_via_whatsapp?: boolean
          sent_at?: string | null
          reminder_count?: number
          last_reminder_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          invoice_number?: string
          order_id?: string
          customer_id?: string
          subtotal_paise?: number
          tax_rate?: number
          tax_amount_paise?: number
          total_amount_paise?: number
          status?: string
          due_date?: string
          paid_amount_paise?: number
          paid_date?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          sent_via_whatsapp?: boolean
          sent_at?: string | null
          reminder_count?: number
          last_reminder_at?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "invoices_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "invoices_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "invoices_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] }
        ]
      }
      payments: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string
          amount_paise: number
          payment_date: string
          payment_method: string
          reference_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id: string
          amount_paise: number
          payment_date: string
          payment_method: string
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          invoice_id?: string
          amount_paise?: number
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "payments_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_invoice_id_fkey"; columns: ["invoice_id"]; referencedRelation: "invoices"; referencedColumns: ["id"] }
        ]
      }
      vendor_orders: {
        Row: {
          id: string
          organization_id: string
          po_number: string
          vendor_id: string
          material_name: string
          quantity: number
          unit: string
          unit_price_paise: number | null
          total_amount_paise: number | null
          status: string
          expected_date: string | null
          received_quantity: number
          received_date: string | null
          triggered_by_order_id: string | null
          quality_status: string
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          po_number: string
          vendor_id: string
          material_name: string
          quantity: number
          unit?: string
          unit_price_paise?: number | null
          total_amount_paise?: number | null
          status?: string
          expected_date?: string | null
          received_quantity?: number
          received_date?: string | null
          triggered_by_order_id?: string | null
          quality_status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          po_number?: string
          vendor_id?: string
          material_name?: string
          quantity?: number
          unit?: string
          unit_price_paise?: number | null
          total_amount_paise?: number | null
          status?: string
          expected_date?: string | null
          received_quantity?: number
          received_date?: string | null
          triggered_by_order_id?: string | null
          quality_status?: string
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "vendor_orders_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "vendor_orders_vendor_id_fkey"; columns: ["vendor_id"]; referencedRelation: "vendors"; referencedColumns: ["id"] },
          { foreignKeyName: "vendor_orders_triggered_by_order_id_fkey"; columns: ["triggered_by_order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] }
        ]
      }
      production_batches: {
        Row: {
          id: string
          organization_id: string
          batch_number: string
          order_id: string | null
          product_id: string
          quantity_produced: number
          quantity_rejected: number
          defect_type: string | null
          shift: string | null
          logged_by: string | null
          source: string
          source_message_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          batch_number: string
          order_id?: string | null
          product_id: string
          quantity_produced: number
          quantity_rejected?: number
          defect_type?: string | null
          shift?: string | null
          logged_by?: string | null
          source?: string
          source_message_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          batch_number?: string
          order_id?: string | null
          product_id?: string
          quantity_produced?: number
          quantity_rejected?: number
          defect_type?: string | null
          shift?: string | null
          logged_by?: string | null
          source?: string
          source_message_id?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "production_batches_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "production_batches_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "production_batches_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "production_batches_logged_by_fkey"; columns: ["logged_by"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      inventory: {
        Row: {
          id: string
          organization_id: string
          item_type: string
          item_name: string
          product_id: string | null
          current_quantity: number
          unit: string
          reorder_level: number
          avg_daily_consumption: number
          last_restocked_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          item_type: string
          item_name: string
          product_id?: string | null
          current_quantity?: number
          unit: string
          reorder_level?: number
          avg_daily_consumption?: number
          last_restocked_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          item_type?: string
          item_name?: string
          product_id?: string | null
          current_quantity?: number
          unit?: string
          reorder_level?: number
          avg_daily_consumption?: number
          last_restocked_at?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "inventory_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          organization_id: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason: string
          reference_type: string | null
          reference_id: string | null
          balance_after: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason: string
          reference_type?: string | null
          reference_id?: string | null
          balance_after: number
          created_by?: string | null
          created_at?: string
        }
        Update: never
        Relationships: [
          { foreignKeyName: "inventory_movements_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_movements_inventory_id_fkey"; columns: ["inventory_id"]; referencedRelation: "inventory"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_movements_created_by_fkey"; columns: ["created_by"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      compliance_tasks: {
        Row: {
          id: string
          organization_id: string
          task_name: string
          category: string
          frequency: string
          due_date: string
          status: string
          completed_date: string | null
          completed_by: string | null
          reminder_sent: boolean
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          task_name: string
          category: string
          frequency: string
          due_date: string
          status?: string
          completed_date?: string | null
          completed_by?: string | null
          reminder_sent?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          task_name?: string
          category?: string
          frequency?: string
          due_date?: string
          status?: string
          completed_date?: string | null
          completed_by?: string | null
          reminder_sent?: boolean
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "compliance_tasks_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "compliance_tasks_completed_by_fkey"; columns: ["completed_by"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      sop_documents: {
        Row: {
          id: string
          organization_id: string
          title: string
          category: string | null
          content: string
          version: number
          status: string
          published_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          category?: string | null
          content: string
          version?: number
          status?: string
          published_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          category?: string | null
          content?: string
          version?: number
          status?: string
          published_by?: string | null
          published_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "sop_documents_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "sop_documents_published_by_fkey"; columns: ["published_by"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      audit_log: {
        Row: {
          id: string
          organization_id: string
          table_name: string
          record_id: string
          action: string
          changed_by: string | null
          changed_by_source: string
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          table_name: string
          record_id: string
          action: string
          changed_by?: string | null
          changed_by_source: string
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          id: string
          organization_id: string
          message_id: string
          direction: string
          sender_phone: string
          message_type: string
          message_body: string | null
          media_url: string | null
          intent_classified: string | null
          intent_confidence: number | null
          eval_score: number | null
          was_triggered: boolean
          was_processed: boolean
          processing_result: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          message_id: string
          direction: string
          sender_phone: string
          message_type: string
          message_body?: string | null
          media_url?: string | null
          intent_classified?: string | null
          intent_confidence?: number | null
          eval_score?: number | null
          was_triggered?: boolean
          was_processed?: boolean
          processing_result?: Json | null
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      eval_benchmark: {
        Row: {
          id: string
          test_case_id: string
          source: string
          raw_message: string
          expected_intent: string
          expected_entities: Json
          expected_matches: Json | null
          actual_output: Json | null
          correction_details: string | null
          difficulty: string
          tags: string[]
          industry: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          test_case_id: string
          source: string
          raw_message: string
          expected_intent: string
          expected_entities: Json
          expected_matches?: Json | null
          actual_output?: Json | null
          correction_details?: string | null
          difficulty?: string
          tags?: string[]
          industry?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          test_case_id?: string
          source?: string
          raw_message?: string
          expected_intent?: string
          expected_entities?: Json
          expected_matches?: Json | null
          actual_output?: Json | null
          correction_details?: string | null
          difficulty?: string
          tags?: string[]
          industry?: string
          is_active?: boolean
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          id: string
          organization_id: string
          event_type: string
          razorpay_event_id: string
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          event_type: string
          razorpay_event_id: string
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          event_type?: string
          razorpay_event_id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: [
          { foreignKeyName: "billing_events_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      feature_addons: {
        Row: {
          id: string
          organization_id: string
          addon_key: string
          is_active: boolean
          razorpay_addon_id: string | null
          activated_at: string
          deactivated_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          addon_key: string
          is_active?: boolean
          razorpay_addon_id?: string | null
          activated_at?: string
          deactivated_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          addon_key?: string
          is_active?: boolean
          razorpay_addon_id?: string | null
          deactivated_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "feature_addons_organization_id_fkey"; columns: ["organization_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
