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
      beta_signups: {
        Row: {
          created_at: string
          email: string
          feature: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          feature?: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          feature?: string
          id?: string
        }
        Relationships: []
      }
      biomarkers_log: {
        Row: {
          context: string | null
          created_at: string
          id: string
          measured_at: string
          notes: string | null
          source: string
          type: string
          unit: string
          user_id: string
          value: number
          value_secondary: number | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          source?: string
          type?: string
          unit: string
          user_id: string
          value: number
          value_secondary?: number | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          source?: string
          type?: string
          unit?: string
          user_id?: string
          value?: number
          value_secondary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biomarkers_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          chat_id: number
          context: Json
          created_at: string | null
          expires_at: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: number
          context?: Json
          created_at?: string | null
          expires_at: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: number
          context?: Json
          created_at?: string | null
          expires_at?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          action: string
          consent_type: string
          created_at: string
          id: string
          platform: string
          policy_version: string | null
          subject_hash: string
          user_id: string | null
        }
        Insert: {
          action: string
          consent_type: string
          created_at?: string
          id?: string
          platform: string
          policy_version?: string | null
          subject_hash: string
          user_id?: string | null
        }
        Update: {
          action?: string
          consent_type?: string
          created_at?: string
          id?: string
          platform?: string
          policy_version?: string | null
          subject_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_policy: {
        Row: {
          id: number
          updated_at: string
          version: string
        }
        Insert: {
          id?: number
          updated_at?: string
          version: string
        }
        Update: {
          id?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      dose_adherence_monthly: {
        Row: {
          expected: number
          missed: number
          month: string
          protocol_id: string
          taken: number
          user_id: string
        }
        Insert: {
          expected: number
          missed: number
          month: string
          protocol_id: string
          taken: number
          user_id: string
        }
        Update: {
          expected?: number
          missed?: number
          month?: string
          protocol_id?: string
          taken?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_adherence_monthly_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_adherence_monthly_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_critical_events: {
        Row: {
          actor: string
          created_at: string
          detail: Json | null
          dose_instance_id: string | null
          event: string
          id: string
          platform: string
          user_id: string
        }
        Insert: {
          actor: string
          created_at?: string
          detail?: Json | null
          dose_instance_id?: string | null
          event: string
          id?: string
          platform: string
          user_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          detail?: Json | null
          dose_instance_id?: string | null
          event?: string
          id?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_critical_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_instances: {
        Row: {
          created_at: string | null
          critical_alarm: boolean
          expected_dose: number
          id: string
          la_push_started_at: string | null
          la_push_state: string | null
          la_push_token: string | null
          medicine_log_id: string | null
          notified_at: string | null
          protocol_id: string
          scheduled_for: string
          snoozed_until: string | null
          status: string
          tolerance_minutes: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          critical_alarm?: boolean
          expected_dose: number
          id?: string
          la_push_started_at?: string | null
          la_push_state?: string | null
          la_push_token?: string | null
          medicine_log_id?: string | null
          notified_at?: string | null
          protocol_id: string
          scheduled_for: string
          snoozed_until?: string | null
          status?: string
          tolerance_minutes?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          critical_alarm?: boolean
          expected_dose?: number
          id?: string
          la_push_started_at?: string | null
          la_push_state?: string | null
          la_push_token?: string | null
          medicine_log_id?: string | null
          notified_at?: string | null
          protocol_id?: string
          scheduled_for?: string
          snoozed_until?: string | null
          status?: string
          tolerance_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_instances_medicine_log_id_fkey"
            columns: ["medicine_log_id"]
            isOneToOne: false
            referencedRelation: "medicine_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_instances_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_notification_queue: {
        Row: {
          correlation_id: string
          created_at: string | null
          error_category: string
          error_code: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          notification_payload: Json
          notification_type: string
          protocol_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          retry_count: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          correlation_id: string
          created_at?: string | null
          error_category?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          notification_payload: Json
          notification_type: string
          protocol_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          correlation_id?: string
          created_at?: string | null
          error_category?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          notification_payload?: Json
          notification_type?: string
          protocol_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_notification_queue_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          app_version: string | null
          comment: string
          created_at: string
          device: string | null
          id: string
          is_resolved: boolean
          platform: string
          rating: number | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          comment: string
          created_at?: string
          device?: string | null
          id?: string
          is_resolved?: boolean
          platform: string
          rating?: number | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          comment?: string
          created_at?: string
          device?: string | null
          id?: string
          is_resolved?: boolean
          platform?: string
          rating?: number | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_reviews: {
        Row: {
          category: string | null
          commit_sha: string
          created_at: string | null
          description: string | null
          file_path: string
          github_issue_number: number | null
          id: string
          issue_hash: string
          line_end: number | null
          line_start: number | null
          pr_number: number
          priority: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          suggestion: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          commit_sha: string
          created_at?: string | null
          description?: string | null
          file_path: string
          github_issue_number?: number | null
          id?: string
          issue_hash: string
          line_end?: number | null
          line_start?: number | null
          pr_number: number
          priority?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggestion?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          commit_sha?: string
          created_at?: string | null
          description?: string | null
          file_path?: string
          github_issue_number?: number | null
          id?: string
          issue_hash?: string
          line_end?: number | null
          line_start?: number | null
          pr_number?: number
          priority?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggestion?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gemini_reviews_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemini_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_nudges: {
        Row: {
          action_payload: Json | null
          action_type: string
          body: string
          created_at: string
          end_at: string | null
          id: string
          is_active: boolean
          max_app_version: string | null
          min_app_version: string | null
          platform: string
          priority: number
          start_at: string | null
          target_view: string
          title: string
          version: number
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          body: string
          created_at?: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          max_app_version?: string | null
          min_app_version?: string | null
          platform?: string
          priority?: number
          start_at?: string | null
          target_view: string
          title: string
          version?: number
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          body?: string
          created_at?: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          max_app_version?: string | null
          min_app_version?: string | null
          platform?: string
          priority?: number
          start_at?: string | null
          target_view?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      medicine_logs: {
        Row: {
          dose_instance_id: string | null
          id: string
          injection_site: string | null
          medicine_id: string | null
          notes: string | null
          protocol_id: string | null
          quantity_taken: number
          taken_at: string | null
          user_id: string
        }
        Insert: {
          dose_instance_id?: string | null
          id?: string
          injection_site?: string | null
          medicine_id?: string | null
          notes?: string | null
          protocol_id?: string | null
          quantity_taken: number
          taken_at?: string | null
          user_id?: string
        }
        Update: {
          dose_instance_id?: string | null
          id?: string
          injection_site?: string | null
          medicine_id?: string | null
          notes?: string | null
          protocol_id?: string | null
          quantity_taken?: number
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_logs_dose_instance_id_fkey"
            columns: ["dose_instance_id"]
            isOneToOne: false
            referencedRelation: "dose_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_logs_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_logs_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          active_ingredient: string | null
          concentration_volume_ml: number | null
          created_at: string | null
          dosage_per_pill: number | null
          dosage_unit: string | null
          id: string
          laboratory: string | null
          name: string
          presentation: string | null
          price_paid: number | null
          regulatory_category: string | null
          shelf_life_days: number | null
          therapeutic_class: string | null
          type: string | null
          units_per_ml: number | null
          user_id: string
        }
        Insert: {
          active_ingredient?: string | null
          concentration_volume_ml?: number | null
          created_at?: string | null
          dosage_per_pill?: number | null
          dosage_unit?: string | null
          id?: string
          laboratory?: string | null
          name: string
          presentation?: string | null
          price_paid?: number | null
          regulatory_category?: string | null
          shelf_life_days?: number | null
          therapeutic_class?: string | null
          type?: string | null
          units_per_ml?: number | null
          user_id?: string
        }
        Update: {
          active_ingredient?: string | null
          concentration_volume_ml?: number | null
          created_at?: string | null
          dosage_per_pill?: number | null
          dosage_unit?: string | null
          id?: string
          laboratory?: string | null
          name?: string
          presentation?: string | null
          price_paid?: number | null
          regulatory_category?: string | null
          shelf_life_days?: number | null
          therapeutic_class?: string | null
          type?: string | null
          units_per_ml?: number | null
          user_id?: string
        }
        Relationships: []
      }
      notification_devices: {
        Row: {
          app_kind: string
          app_version: string | null
          created_at: string
          device_fingerprint: string | null
          device_name: string | null
          id: string
          is_active: boolean
          last_seen_at: string
          native_alarm_enabled: boolean
          platform: string
          provider: string
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_kind: string
          app_version?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          native_alarm_enabled?: boolean
          platform: string
          provider: string
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_kind?: string
          app_version?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          native_alarm_enabled?: boolean
          platform?: string
          provider?: string
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          channels: Json | null
          created_at: string | null
          id: string
          medicine_name: string | null
          mensagem_erro: string | null
          notification_type: string
          protocol_id: string | null
          protocol_name: string | null
          provider_metadata: Json | null
          sent_at: string | null
          status: string | null
          telegram_message_id: number | null
          title: string | null
          treatment_plan_id: string | null
          treatment_plan_name: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          medicine_name?: string | null
          mensagem_erro?: string | null
          notification_type: string
          protocol_id?: string | null
          protocol_name?: string | null
          provider_metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
          title?: string | null
          treatment_plan_id?: string | null
          treatment_plan_name?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          medicine_name?: string | null
          mensagem_erro?: string | null
          notification_type?: string
          protocol_id?: string | null
          protocol_name?: string | null
          provider_metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
          title?: string | null
          treatment_plan_id?: string | null
          treatment_plan_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel_results: Json | null
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          period_key: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel_results?: Json | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          period_key: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel_results?: Json | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          period_key?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          active: boolean | null
          created_at: string | null
          critical_alarm: boolean
          current_stage_index: number | null
          dosage_per_intake: number | null
          end_date: string | null
          frequency: string | null
          generated_through: string | null
          id: string
          intake_unit: string | null
          last_notified_at: string | null
          last_soft_reminder_at: string | null
          medicine_id: string | null
          name: string
          notes: string | null
          paused_at: string | null
          stage_started_at: string | null
          start_date: string
          status_ultima_notificacao: string | null
          target_dosage: number | null
          time_schedule: Json | null
          titration_schedule: Json | null
          titration_status: string | null
          treatment_plan_id: string | null
          user_id: string
          weekdays: string[] | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          critical_alarm?: boolean
          current_stage_index?: number | null
          dosage_per_intake?: number | null
          end_date?: string | null
          frequency?: string | null
          generated_through?: string | null
          id?: string
          intake_unit?: string | null
          last_notified_at?: string | null
          last_soft_reminder_at?: string | null
          medicine_id?: string | null
          name: string
          notes?: string | null
          paused_at?: string | null
          stage_started_at?: string | null
          start_date: string
          status_ultima_notificacao?: string | null
          target_dosage?: number | null
          time_schedule?: Json | null
          titration_schedule?: Json | null
          titration_status?: string | null
          treatment_plan_id?: string | null
          user_id?: string
          weekdays?: string[] | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          critical_alarm?: boolean
          current_stage_index?: number | null
          dosage_per_intake?: number | null
          end_date?: string | null
          frequency?: string | null
          generated_through?: string | null
          id?: string
          intake_unit?: string | null
          last_notified_at?: string | null
          last_soft_reminder_at?: string | null
          medicine_id?: string | null
          name?: string
          notes?: string | null
          paused_at?: string | null
          stage_started_at?: string | null
          start_date?: string
          status_ultima_notificacao?: string | null
          target_dosage?: number | null
          time_schedule?: Json | null
          titration_schedule?: Json | null
          titration_status?: string | null
          treatment_plan_id?: string | null
          user_id?: string
          weekdays?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "protocols_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          expiration_date: string | null
          id: string
          injection_container: string | null
          laboratory: string | null
          legacy_stock_id: string | null
          medicine_id: string
          notes: string | null
          pharmacy: string | null
          purchase_date: string
          quantity_bought: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          injection_container?: string | null
          laboratory?: string | null
          legacy_stock_id?: string | null
          medicine_id: string
          notes?: string | null
          pharmacy?: string | null
          purchase_date: string
          quantity_bought: number
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          injection_container?: string | null
          laboratory?: string | null
          legacy_stock_id?: string | null
          medicine_id?: string
          notes?: string | null
          pharmacy?: string | null
          purchase_date?: string
          quantity_bought?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_logs: {
        Row: {
          body: string
          delivered: boolean | null
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string | null
          subscription_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          subscription_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          subscription_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          created_at: string | null
          entry_type: string | null
          expiration_date: string | null
          id: string
          injection_container: string | null
          medicine_id: string | null
          notes: string | null
          opened_at: string | null
          original_quantity: number | null
          purchase_date: string | null
          purchase_id: string | null
          quantity: number
          unit_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_type?: string | null
          expiration_date?: string | null
          id?: string
          injection_container?: string | null
          medicine_id?: string | null
          notes?: string | null
          opened_at?: string | null
          original_quantity?: number | null
          purchase_date?: string | null
          purchase_id?: string | null
          quantity: number
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          entry_type?: string | null
          expiration_date?: string | null
          id?: string
          injection_container?: string | null
          medicine_id?: string | null
          notes?: string | null
          opened_at?: string | null
          original_quantity?: number | null
          purchase_date?: string | null
          purchase_id?: string | null
          quantity?: number
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          created_at: string
          id: string
          medicine_id: string
          notes: string | null
          quantity_delta: number
          reason: string
          reference_id: string | null
          stock_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medicine_id: string
          notes?: string | null
          quantity_delta: number
          reason: string
          reference_id?: string | null
          stock_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medicine_id?: string
          notes?: string | null
          quantity_delta?: number
          reason?: string
          reference_id?: string | null
          stock_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_consumptions: {
        Row: {
          created_at: string
          id: string
          medicine_id: string
          medicine_log_id: string
          quantity_consumed: number
          reversed_at: string | null
          stock_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medicine_id: string
          medicine_log_id: string
          quantity_consumed: number
          reversed_at?: string | null
          stock_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medicine_id?: string
          medicine_log_id?: string
          quantity_consumed?: number
          reversed_at?: string | null
          stock_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_consumptions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumptions_medicine_log_id_fkey"
            columns: ["medicine_log_id"]
            isOneToOne: false
            referencedRelation: "medicine_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumptions_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          id: string
          name: string
          objective: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          name: string
          objective?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          name?: string
          objective?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          birth_date: string | null
          channel_mobile_push_enabled: boolean
          channel_telegram_enabled: boolean
          channel_web_push_enabled: boolean
          city: string | null
          complexity_override: string | null
          consent_prompt_last_seen_at: string | null
          consent_prompt_sessions: number
          created_at: string | null
          digest_time: string | null
          display_name: string | null
          emergency_card: Json | null
          id: string
          notification_mode: string | null
          notification_preference: string | null
          onboarding_completed: boolean | null
          phone: string | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          state: string | null
          stock_paused_at: string | null
          stock_tracking_enabled: boolean
          telegram_chat_id: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          verification_token: string | null
        }
        Insert: {
          birth_date?: string | null
          channel_mobile_push_enabled?: boolean
          channel_telegram_enabled?: boolean
          channel_web_push_enabled?: boolean
          city?: string | null
          complexity_override?: string | null
          consent_prompt_last_seen_at?: string | null
          consent_prompt_sessions?: number
          created_at?: string | null
          digest_time?: string | null
          display_name?: string | null
          emergency_card?: Json | null
          id?: string
          notification_mode?: string | null
          notification_preference?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          state?: string | null
          stock_paused_at?: string | null
          stock_tracking_enabled?: boolean
          telegram_chat_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          verification_token?: string | null
        }
        Update: {
          birth_date?: string | null
          channel_mobile_push_enabled?: boolean
          channel_telegram_enabled?: boolean
          channel_web_push_enabled?: boolean
          city?: string | null
          complexity_override?: string | null
          consent_prompt_last_seen_at?: string | null
          consent_prompt_sessions?: number
          created_at?: string | null
          digest_time?: string | null
          display_name?: string | null
          emergency_card?: Json | null
          id?: string
          notification_mode?: string | null
          notification_preference?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          state?: string | null
          stock_paused_at?: string | null
          stock_tracking_enabled?: boolean
          telegram_chat_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          verification_token?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      feedback_stats: {
        Row: {
          avg_rating: number | null
          pending_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      medicine_stock_summary: {
        Row: {
          medicine_id: string | null
          newest_entry_date: string | null
          oldest_entry_date: string | null
          stock_entries_count: number | null
          total_quantity: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_emails: {
        Row: {
          email: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
      v_adherence_heatmap: {
        Row: {
          adherence_percentage: number | null
          day_of_week: number | null
          expected_doses: number | null
          period_index: number | null
          taken_doses: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_adherence: {
        Row: {
          adherence_percentage: number | null
          expected_doses: number | null
          log_date: string | null
          taken_doses: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dose_critical_summary: {
        Row: {
          dose_instance_id: string | null
          duracao: string | null
          eventos: number | null
          fim: string | null
          inicio: string | null
          resolvida: boolean | null
          teve_suprimido: boolean | null
          trajetoria: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_critical_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dose_critical_trace: {
        Row: {
          actor: string | null
          created_at: string | null
          detail: Json | null
          dose_instance_id: string | null
          elapsed: string | null
          event: string | null
          id: string | null
          platform: string | null
          seq: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_critical_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_emails"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _delete_user_account_core: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      apply_manual_stock_adjustment: {
        Args: {
          p_medicine_id: string
          p_notes?: string
          p_quantity_delta: number
          p_reason: string
        }
        Returns: Json
      }
      batch_update_review_status: {
        Args: {
          new_status: string
          resolution_type?: string
          review_ids: string[]
        }
        Returns: number
      }
      claim_notification_outbox: {
        Args: { batch_limit?: number }
        Returns: {
          attempts: number
          channel_results: Json | null
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          period_key: string
          sent_at: string | null
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_bot_sessions: { Args: never; Returns: number }
      consent_grant: {
        Args: { p_consent_type: string; p_platform: string }
        Returns: string
      }
      consent_pepper: { Args: never; Returns: string }
      consent_revoke: {
        Args: { p_consent_type: string; p_platform: string }
        Returns: string
      }
      consent_subject_hash: { Args: { p_email: string }; Returns: string }
      consent_write: {
        Args: { p_action: string; p_consent_type: string; p_platform: string }
        Returns: string
      }
      consume_stock_fifo: {
        Args: {
          p_medicine_id: string
          p_medicine_log_id: string
          p_quantity: number
          p_user_id: string
        }
        Returns: Json
      }
      create_purchase_with_stock: {
        Args: {
          p_expiration_date?: string
          p_injection_container?: string
          p_laboratory?: string
          p_medicine_id: string
          p_notes?: string
          p_pharmacy?: string
          p_purchase_date?: string
          p_quantity: number
          p_unit_price?: number
        }
        Returns: Json
      }
      deactivate_stale_notification_devices: {
        Args: { ttl_days?: number }
        Returns: number
      }
      delete_dose_log_atomic: {
        Args: {
          p_default_tolerance_minutes?: number
          p_log_id: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_user_account: { Args: never; Returns: undefined }
      delete_user_account_by_id: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_telegram_token: { Args: never; Returns: string }
      get_dlq_stats: {
        Args: never
        Returns: {
          count: number
          error_category: string
          oldest_failure: string
          status: string
        }[]
      }
      get_low_stock_medicines: {
        Args: { p_threshold?: number; p_user_id: string }
        Returns: {
          medicine_id: string
          newest_entry_date: string
          oldest_entry_date: string
          stock_entries_count: number
          total_quantity: number
        }[]
      }
      migrate_pilot_data: { Args: never; Returns: undefined }
      prune_notification_outbox: {
        Args: { retention_days?: number }
        Returns: number
      }
      refresh_stock_summary: { Args: never; Returns: undefined }
      register_dose_atomic: {
        Args: {
          p_dose_instance_id: string
          p_injection_site?: string
          p_medicine_id: string
          p_notes: string
          p_protocol_id: string
          p_quantity_taken: number
          p_strict_anchor?: boolean
          p_taken_at: string
          p_user_id: string
        }
        Returns: Json
      }
      restore_stock_for_log: {
        Args: {
          p_medicine_log_id: string
          p_reason?: string
          p_user_id?: string
        }
        Returns: Json
      }
      update_dose_log_atomic: {
        Args: {
          p_has_injection_site?: boolean
          p_has_notes?: boolean
          p_has_protocol?: boolean
          p_injection_site?: string
          p_log_id: string
          p_medicine_id: string
          p_notes: string
          p_protocol_id: string
          p_quantity_taken: number
          p_taken_at: string
          p_user_id: string
        }
        Returns: Json
      }
      upsert_notification_device: {
        Args: {
          p_app_kind: string
          p_app_version: string
          p_device_fingerprint: string
          p_device_name: string
          p_native_alarm_enabled?: boolean
          p_platform: string
          p_provider: string
          p_push_token: string
        }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
