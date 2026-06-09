export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_source: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_source: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_source?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          processed: boolean
          razorpay_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload: Json
          processed?: boolean
          razorpay_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          processed?: boolean
          razorpay_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_tasks: {
        Row: {
          category: string
          completed_by: string | null
          completed_date: string | null
          created_at: string
          deleted_at: string | null
          due_date: string
          frequency: string
          id: string
          notes: string | null
          organization_id: string
          reminder_sent: boolean
          status: string
          task_name: string
          updated_at: string
        }
        Insert: {
          category: string
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date: string
          frequency: string
          id?: string
          notes?: string | null
          organization_id: string
          reminder_sent?: boolean
          status?: string
          task_name: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          frequency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          reminder_sent?: boolean
          status?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          aliases: string[]
          city: string | null
          company_name: string | null
          created_at: string
          credit_limit_paise: number
          deleted_at: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number
          phone: string | null
          state: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          aliases?: string[]
          city?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit_paise?: number
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          aliases?: string[]
          city?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit_paise?: number
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_benchmark: {
        Row: {
          actual_output: Json | null
          correction_details: string | null
          created_at: string
          difficulty: string
          expected_entities: Json
          expected_intent: string
          expected_matches: Json | null
          id: string
          industry: string
          is_active: boolean
          raw_message: string
          source: string
          tags: string[]
          test_case_id: string
        }
        Insert: {
          actual_output?: Json | null
          correction_details?: string | null
          created_at?: string
          difficulty?: string
          expected_entities: Json
          expected_intent: string
          expected_matches?: Json | null
          id?: string
          industry?: string
          is_active?: boolean
          raw_message: string
          source: string
          tags?: string[]
          test_case_id: string
        }
        Update: {
          actual_output?: Json | null
          correction_details?: string | null
          created_at?: string
          difficulty?: string
          expected_entities?: Json
          expected_intent?: string
          expected_matches?: Json | null
          id?: string
          industry?: string
          is_active?: boolean
          raw_message?: string
          source?: string
          tags?: string[]
          test_case_id?: string
        }
        Relationships: []
      }
      feature_addons: {
        Row: {
          activated_at: string
          addon_key: string
          created_at: string
          deactivated_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          organization_id: string
          razorpay_addon_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          addon_key: string
          created_at?: string
          deactivated_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          razorpay_addon_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          addon_key?: string
          created_at?: string
          deactivated_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          razorpay_addon_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_addons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          avg_daily_consumption: number
          created_at: string
          current_quantity: number
          deleted_at: string | null
          id: string
          item_name: string
          item_type: string
          last_restocked_at: string | null
          notes: string | null
          organization_id: string
          product_id: string | null
          reorder_level: number
          unit: string
          updated_at: string
        }
        Insert: {
          avg_daily_consumption?: number
          created_at?: string
          current_quantity?: number
          deleted_at?: string | null
          id?: string
          item_name: string
          item_type: string
          last_restocked_at?: string | null
          notes?: string | null
          organization_id: string
          product_id?: string | null
          reorder_level?: number
          unit: string
          updated_at?: string
        }
        Update: {
          avg_daily_consumption?: number
          created_at?: string
          current_quantity?: number
          deleted_at?: string | null
          id?: string
          item_name?: string
          item_type?: string
          last_restocked_at?: string | null
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          reorder_level?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          inventory_id: string
          movement_type: string
          organization_id: string
          quantity: number
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id: string
          movement_type: string
          organization_id: string
          quantity: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id?: string
          movement_type?: string
          organization_id?: string
          quantity?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          deleted_at: string | null
          due_date: string
          id: string
          invoice_number: string
          last_reminder_at: string | null
          notes: string | null
          order_id: string | null
          organization_id: string
          paid_amount_paise: number
          paid_date: string | null
          payment_method: string | null
          pdf_url: string | null
          reminder_count: number
          sent_at: string | null
          sent_via_whatsapp: boolean
          status: string
          subtotal_paise: number
          tax_amount_paise: number
          tax_rate: number
          total_amount_paise: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          last_reminder_at?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id: string
          paid_amount_paise?: number
          paid_date?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          reminder_count?: number
          sent_at?: string | null
          sent_via_whatsapp?: boolean
          status?: string
          subtotal_paise: number
          tax_amount_paise: number
          tax_rate?: number
          total_amount_paise: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          last_reminder_at?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id?: string
          paid_amount_paise?: number
          paid_date?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          reminder_count?: number
          sent_at?: string | null
          sent_via_whatsapp?: boolean
          status?: string
          subtotal_paise?: number
          tax_amount_paise?: number
          tax_rate?: number
          total_amount_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          deleted_at: string | null
          delivery_date: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          organization_id: string
          product_id: string
          quantity: number
          quantity_dispatched: number
          quantity_produced: number
          source: string
          source_message_id: string | null
          status: string
          total_amount_paise: number
          unit_price_paise: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number: string
          organization_id: string
          product_id: string
          quantity: number
          quantity_dispatched?: number
          quantity_produced?: number
          source?: string
          source_message_id?: string | null
          status?: string
          total_amount_paise: number
          unit_price_paise: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          quantity_dispatched?: number
          quantity_produced?: number
          source?: string
          source_message_id?: string | null
          status?: string
          total_amount_paise?: number
          unit_price_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          auto_mode_enabled: boolean
          billing_status: string
          city: string
          created_at: string
          deleted_at: string | null
          email: string | null
          gstin: string | null
          id: string
          industry_config: string
          language_preference: string
          name: string
          onboarded_at: string | null
          phone: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          state: string
          tier: string
          tier_valid_until: string | null
          timezone: string
          updated_at: string
          whatsapp_connected: boolean
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          auto_mode_enabled?: boolean
          billing_status?: string
          city: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          industry_config?: string
          language_preference?: string
          name: string
          onboarded_at?: string | null
          phone: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          state?: string
          tier?: string
          tier_valid_until?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_connected?: boolean
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          auto_mode_enabled?: boolean
          billing_status?: string
          city?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          industry_config?: string
          language_preference?: string
          name?: string
          onboarded_at?: string | null
          phone?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          state?: string
          tier?: string
          tier_valid_until?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_connected?: boolean
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          deleted_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: string
          created_at: string
          defect_type: string | null
          deleted_at: string | null
          id: string
          logged_by: string | null
          notes: string | null
          order_id: string | null
          organization_id: string
          product_id: string
          quantity_produced: number
          quantity_rejected: number
          shift: string | null
          source: string
          source_message_id: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          defect_type?: string | null
          deleted_at?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id: string
          product_id: string
          quantity_produced: number
          quantity_rejected?: number
          shift?: string | null
          source?: string
          source_message_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          defect_type?: string | null
          deleted_at?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id?: string
          product_id?: string
          quantity_produced?: number
          quantity_rejected?: number
          shift?: string | null
          source?: string
          source_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          aliases: string[]
          category: string | null
          code: string | null
          created_at: string
          deleted_at: string | null
          hsn_code: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          raw_materials: Json
          reorder_level: number
          unit: string
          unit_price_paise: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          category?: string | null
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          hsn_code?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          raw_materials?: Json
          reorder_level?: number
          unit?: string
          unit_price_paise?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          category?: string | null
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          hsn_code?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          raw_materials?: Json
          reorder_level?: number
          unit?: string
          unit_price_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_documents: {
        Row: {
          category: string | null
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sop_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_documents_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          organization_id: string
          phone: string | null
          role: string
          supabase_auth_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          organization_id: string
          phone?: string | null
          role?: string
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          organization_id?: string
          phone?: string | null
          role?: string
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_orders: {
        Row: {
          created_at: string
          deleted_at: string | null
          expected_date: string | null
          id: string
          material_name: string
          notes: string | null
          organization_id: string
          po_number: string
          quality_status: string
          quantity: number
          received_date: string | null
          received_quantity: number
          status: string
          total_amount_paise: number | null
          triggered_by_order_id: string | null
          unit: string
          unit_price_paise: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          expected_date?: string | null
          id?: string
          material_name: string
          notes?: string | null
          organization_id: string
          po_number: string
          quality_status?: string
          quantity: number
          received_date?: string | null
          received_quantity?: number
          status?: string
          total_amount_paise?: number | null
          triggered_by_order_id?: string | null
          unit?: string
          unit_price_paise?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          expected_date?: string | null
          id?: string
          material_name?: string
          notes?: string | null
          organization_id?: string
          po_number?: string
          quality_status?: string
          quantity?: number
          received_date?: string | null
          received_quantity?: number
          status?: string
          total_amount_paise?: number | null
          triggered_by_order_id?: string | null
          unit?: string
          unit_price_paise?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_orders_triggered_by_order_id_fkey"
            columns: ["triggered_by_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          aliases: string[]
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          gstin: string | null
          id: string
          materials_supplied: string[] | null
          name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number
          phone: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          aliases?: string[]
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          materials_supplied?: string[] | null
          name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string | null
          rating?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          aliases?: string[]
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          materials_supplied?: string[] | null
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          eval_score: number | null
          id: string
          intent_classified: string | null
          intent_confidence: number | null
          media_url: string | null
          message_body: string | null
          message_id: string
          message_type: string
          organization_id: string
          processing_result: Json | null
          sender_phone: string
          was_processed: boolean
          was_triggered: boolean
        }
        Insert: {
          created_at?: string
          direction: string
          eval_score?: number | null
          id?: string
          intent_classified?: string | null
          intent_confidence?: number | null
          media_url?: string | null
          message_body?: string | null
          message_id: string
          message_type: string
          organization_id: string
          processing_result?: Json | null
          sender_phone: string
          was_processed?: boolean
          was_triggered?: boolean
        }
        Update: {
          created_at?: string
          direction?: string
          eval_score?: number | null
          id?: string
          intent_classified?: string | null
          intent_confidence?: number | null
          media_url?: string | null
          message_body?: string | null
          message_id?: string
          message_type?: string
          organization_id?: string
          processing_result?: Json | null
          sender_phone?: string
          was_processed?: boolean
          was_triggered?: boolean
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          sender_phone: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
          sender_phone: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          sender_phone?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _current_org_id: { Args: never; Returns: string }
      _current_role: { Args: never; Returns: string }
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

