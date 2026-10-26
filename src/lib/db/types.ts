export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_insights: {
        Row: {
          ai_run_id: string | null
          client_id: string | null
          created_at: string
          id: string
          items: Json
          week_start: string
        }
        Insert: {
          ai_run_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          week_start: string
        }
        Update: {
          ai_run_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          cache_read_tokens: number | null
          cost_usd: number | null
          created_at: string
          effort: string | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          input_tokens: number | null
          kind: Database["public"]["Enums"]["ai_run_kind"]
          latency_ms: number | null
          model: string
          output: Json | null
          output_tokens: number | null
          prompt_version: string | null
          status: Database["public"]["Enums"]["ai_run_status"]
        }
        Insert: {
          cache_read_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          effort?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          input_tokens?: number | null
          kind: Database["public"]["Enums"]["ai_run_kind"]
          latency_ms?: number | null
          model: string
          output?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          status?: Database["public"]["Enums"]["ai_run_status"]
        }
        Update: {
          cache_read_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          effort?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          input_tokens?: number | null
          kind?: Database["public"]["Enums"]["ai_run_kind"]
          latency_ms?: number | null
          model?: string
          output?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          status?: Database["public"]["Enums"]["ai_run_status"]
        }
        Relationships: []
      }
      application_stage_events: {
        Row: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id: string | null
          application_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Insert: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Update: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["application_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_stage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_stage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_stage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
        ]
      }
      applications: {
        Row: {
          agreed_salary: number | null
          ai_note: string | null
          applied_at: string
          assigned_at: string | null
          assigned_recruiter_id: string | null
          availability_notes: string | null
          available: boolean | null
          candidate_id: string
          client_decision: Database["public"]["Enums"]["client_decision"] | null
          client_decision_at: string | null
          client_decision_by: string | null
          client_decision_comment: string | null
          commute_minutes: number | null
          confirmation_sheet_path: string | null
          confirmation_signed_at: string | null
          created_at: string
          cv_ai_rationale: string | null
          cv_score: number | null
          cv_score_breakdown: Json | null
          cv_score_version: number | null
          cv_scored_at: string | null
          discard_reason: string | null
          discard_reason_key:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_at: string | null
          discarded_by: Database["public"]["Enums"]["actor_type"] | null
          discarded_by_user_id: string | null
          discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          experience_months: number | null
          hired_at: string | null
          id: string
          import_batch_id: string | null
          prefilter_result: Json | null
          prefilter_status: Database["public"]["Enums"]["prefilter_status"]
          profile_id: string
          salary_expectation: number | null
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["application_stage"]
          stage_changed_at: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          agreed_salary?: number | null
          ai_note?: string | null
          applied_at?: string
          assigned_at?: string | null
          assigned_recruiter_id?: string | null
          availability_notes?: string | null
          available?: boolean | null
          candidate_id: string
          client_decision?:
            | Database["public"]["Enums"]["client_decision"]
            | null
          client_decision_at?: string | null
          client_decision_by?: string | null
          client_decision_comment?: string | null
          commute_minutes?: number | null
          confirmation_sheet_path?: string | null
          confirmation_signed_at?: string | null
          created_at?: string
          cv_ai_rationale?: string | null
          cv_score?: number | null
          cv_score_breakdown?: Json | null
          cv_score_version?: number | null
          cv_scored_at?: string | null
          discard_reason?: string | null
          discard_reason_key?:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_at?: string | null
          discarded_by?: Database["public"]["Enums"]["actor_type"] | null
          discarded_by_user_id?: string | null
          discarded_from_stage?:
            | Database["public"]["Enums"]["application_stage"]
            | null
          experience_months?: number | null
          hired_at?: string | null
          id?: string
          import_batch_id?: string | null
          prefilter_result?: Json | null
          prefilter_status?: Database["public"]["Enums"]["prefilter_status"]
          profile_id: string
          salary_expectation?: number | null
          source_channel?: Database["public"]["Enums"]["source_channel"]
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_changed_at?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          agreed_salary?: number | null
          ai_note?: string | null
          applied_at?: string
          assigned_at?: string | null
          assigned_recruiter_id?: string | null
          availability_notes?: string | null
          available?: boolean | null
          candidate_id?: string
          client_decision?:
            | Database["public"]["Enums"]["client_decision"]
            | null
          client_decision_at?: string | null
          client_decision_by?: string | null
          client_decision_comment?: string | null
          commute_minutes?: number | null
          confirmation_sheet_path?: string | null
          confirmation_signed_at?: string | null
          created_at?: string
          cv_ai_rationale?: string | null
          cv_score?: number | null
          cv_score_breakdown?: Json | null
          cv_score_version?: number | null
          cv_scored_at?: string | null
          discard_reason?: string | null
          discard_reason_key?:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_at?: string | null
          discarded_by?: Database["public"]["Enums"]["actor_type"] | null
          discarded_by_user_id?: string | null
          discarded_from_stage?:
            | Database["public"]["Enums"]["application_stage"]
            | null
          experience_months?: number | null
          hired_at?: string | null
          id?: string
          import_batch_id?: string | null
          prefilter_result?: Json | null
          prefilter_status?: Database["public"]["Enums"]["prefilter_status"]
          profile_id?: string
          salary_expectation?: number | null
          source_channel?: Database["public"]["Enums"]["source_channel"]
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_changed_at?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_client_decision_by_fkey"
            columns: ["client_decision_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_discarded_by_user_id_fkey"
            columns: ["discarded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_blacklist: {
        Row: {
          added_at: string
          added_by: string | null
          candidate_id: string | null
          created_at: string
          curp: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          reason_key: Database["public"]["Enums"]["blacklist_reason"]
          reason_note: string | null
          removed_at: string | null
          removed_by: string | null
          removed_note: string | null
          updated_at: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          candidate_id?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_e164?: string | null
          reason_key: Database["public"]["Enums"]["blacklist_reason"]
          reason_note?: string | null
          removed_at?: string | null
          removed_by?: string | null
          removed_note?: string | null
          updated_at?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          candidate_id?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_e164?: string | null
          reason_key?: Database["public"]["Enums"]["blacklist_reason"]
          reason_note?: string | null
          removed_at?: string | null
          removed_by?: string | null
          removed_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_blacklist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_blacklist_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_blacklist_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          ai_check: Json | null
          ai_run_id: string | null
          application_id: string | null
          candidate_id: string
          created_at: string
          document_type_key: string
          file_path: string | null
          id: string
          mime: string | null
          received_via: Database["public"]["Enums"]["received_via"] | null
          rejected_reason: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["doc_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          ai_check?: Json | null
          ai_run_id?: string | null
          application_id?: string | null
          candidate_id: string
          created_at?: string
          document_type_key: string
          file_path?: string | null
          id?: string
          mime?: string | null
          received_via?: Database["public"]["Enums"]["received_via"] | null
          rejected_reason?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          ai_check?: Json | null
          ai_run_id?: string | null
          application_id?: string | null
          candidate_id?: string
          created_at?: string
          document_type_key?: string
          file_path?: string | null
          id?: string
          mime?: string | null
          received_via?: Database["public"]["Enums"]["received_via"] | null
          rejected_reason?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_document_type_key_fkey"
            columns: ["document_type_key"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "candidate_documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          address_line: string | null
          age_reported: number | null
          birth_date: string | null
          created_at: string
          curp: string | null
          cv_file_path: string | null
          cv_summary: string | null
          cv_text: string | null
          education_level: string | null
          email: string | null
          first_name: string | null
          full_name: string
          gender: string | null
          id: string
          in_prime_pool: boolean
          municipality: string | null
          notes: string | null
          nss: string | null
          phone_e164: string
          privacy_consent_at: string | null
          privacy_consent_via: string | null
          retention_until: string | null
          rfc: string | null
          updated_at: string
          whaapy_contact_id: string | null
          zone: string | null
        }
        Insert: {
          address_line?: string | null
          age_reported?: number | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          cv_file_path?: string | null
          cv_summary?: string | null
          cv_text?: string | null
          education_level?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          gender?: string | null
          id?: string
          in_prime_pool?: boolean
          municipality?: string | null
          notes?: string | null
          nss?: string | null
          phone_e164: string
          privacy_consent_at?: string | null
          privacy_consent_via?: string | null
          retention_until?: string | null
          rfc?: string | null
          updated_at?: string
          whaapy_contact_id?: string | null
          zone?: string | null
        }
        Update: {
          address_line?: string | null
          age_reported?: number | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          cv_file_path?: string | null
          cv_summary?: string | null
          cv_text?: string | null
          education_level?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          in_prime_pool?: boolean
          municipality?: string | null
          notes?: string | null
          nss?: string | null
          phone_e164?: string
          privacy_consent_at?: string | null
          privacy_consent_via?: string | null
          retention_until?: string | null
          rfc?: string | null
          updated_at?: string
          whaapy_contact_id?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          client_since: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string
          daily_report_time: string
          id: string
          industry: string | null
          is_active: boolean
          legal_name: string | null
          name: string
          portal_enabled: boolean
          report_recipients: string[]
          timezone: string
          trade_name: string | null
          updated_at: string
          weekly_report_dow: number
          weekly_report_time: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_since?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          daily_report_time?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          legal_name?: string | null
          name: string
          portal_enabled?: boolean
          report_recipients?: string[]
          timezone?: string
          trade_name?: string | null
          updated_at?: string
          weekly_report_dow?: number
          weekly_report_time?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_since?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          daily_report_time?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          legal_name?: string | null
          name?: string
          portal_enabled?: boolean
          report_recipients?: string[]
          timezone?: string
          trade_name?: string | null
          updated_at?: string
          weekly_report_dow?: number
          weekly_report_time?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          accepts: string[]
          key: string
          label: string
          required: boolean
          sort_order: number
          validation_hints: string | null
        }
        Insert: {
          accepts?: string[]
          key: string
          label: string
          required?: boolean
          sort_order?: number
          validation_hints?: string | null
        }
        Update: {
          accepts?: string[]
          key?: string
          label?: string
          required?: boolean
          sort_order?: number
          validation_hints?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_count: number
          errors: Json
          failed_count: number
          file_name: string | null
          file_path: string | null
          finished_at: string | null
          id: string
          profile_id: string
          skipped_count: number
          source_channel: Database["public"]["Enums"]["source_channel"]
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          errors?: Json
          failed_count?: number
          file_name?: string | null
          file_path?: string | null
          finished_at?: string | null
          id?: string
          profile_id: string
          skipped_count?: number
          source_channel?: Database["public"]["Enums"]["source_channel"]
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          errors?: Json
          failed_count?: number
          file_name?: string | null
          file_path?: string | null
          finished_at?: string | null
          id?: string
          profile_id?: string
          skipped_count?: number
          source_channel?: Database["public"]["Enums"]["source_channel"]
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      interview_transcripts: {
        Row: {
          duration_sec: number | null
          fireflies_transcript_id: string | null
          interview_id: string
          language: string | null
          received_at: string
          sentences: Json | null
          text: string | null
        }
        Insert: {
          duration_sec?: number | null
          fireflies_transcript_id?: string | null
          interview_id: string
          language?: string | null
          received_at?: string
          sentences?: Json | null
          text?: string | null
        }
        Update: {
          duration_sec?: number | null
          fireflies_transcript_id?: string | null
          interview_id?: string
          language?: string | null
          received_at?: string
          sentences?: Json | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_transcripts_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_transcripts_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "v_pipeline"
            referencedColumns: ["client_interview_id"]
          },
          {
            foreignKeyName: "interview_transcripts_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "v_pipeline"
            referencedColumns: ["prime_interview_id"]
          },
        ]
      }
      interviews: {
        Row: {
          ai_run_id: string | null
          analysis_version: string | null
          analyzed_at: string | null
          application_id: string
          calendar_event_id: string | null
          calendar_owner_id: string | null
          client_interviewer_name: string | null
          created_at: string
          duration_min: number
          findings: Json | null
          fireflies_meeting_id: string | null
          id: string
          interviewer_user_id: string | null
          meeting_url: string | null
          platform: Database["public"]["Enums"]["meeting_platform"]
          scheduled_at: string | null
          score: number | null
          status: Database["public"]["Enums"]["interview_status"]
          summary: string | null
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
        }
        Insert: {
          ai_run_id?: string | null
          analysis_version?: string | null
          analyzed_at?: string | null
          application_id: string
          calendar_event_id?: string | null
          calendar_owner_id?: string | null
          client_interviewer_name?: string | null
          created_at?: string
          duration_min?: number
          findings?: Json | null
          fireflies_meeting_id?: string | null
          id?: string
          interviewer_user_id?: string | null
          meeting_url?: string | null
          platform?: Database["public"]["Enums"]["meeting_platform"]
          scheduled_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["interview_status"]
          summary?: string | null
          type: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Update: {
          ai_run_id?: string | null
          analysis_version?: string | null
          analyzed_at?: string | null
          application_id?: string
          calendar_event_id?: string | null
          calendar_owner_id?: string | null
          client_interviewer_name?: string | null
          created_at?: string
          duration_min?: number
          findings?: Json | null
          fireflies_meeting_id?: string | null
          id?: string
          interviewer_user_id?: string | null
          meeting_url?: string | null
          platform?: Database["public"]["Enums"]["meeting_platform"]
          scheduled_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["interview_status"]
          summary?: string | null
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_calendar_owner_id_fkey"
            columns: ["calendar_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_user_id_fkey"
            columns: ["interviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_intakes: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          form: Json
          id: string
          profile_id: string | null
          status: Database["public"]["Enums"]["intake_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          form?: Json
          id?: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["intake_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          form?: Json
          id?: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["intake_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_intakes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_intakes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_intakes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      job_profile_ai_configs: {
        Row: {
          age_is_blocking: boolean
          age_max: number | null
          age_min: number | null
          commute_max_min: number | null
          created_at: string
          cv_threshold: number
          cv_version: number
          cv_weights: Json
          education_min: string | null
          experience_min_months: number | null
          generated_at: string | null
          generated_by_ai: boolean
          prefilter_questions: Json
          profile_id: string
          prompt_version: string | null
          psych_blocking: Json
          psych_minimums: Json
          requires_saturdays: boolean
          salary_expectation_max: number | null
          salary_is_blocking: boolean
          schedule_text: string | null
          updated_at: string
          version: number
        }
        Insert: {
          age_is_blocking?: boolean
          age_max?: number | null
          age_min?: number | null
          commute_max_min?: number | null
          created_at?: string
          cv_threshold?: number
          cv_version?: number
          cv_weights?: Json
          education_min?: string | null
          experience_min_months?: number | null
          generated_at?: string | null
          generated_by_ai?: boolean
          prefilter_questions?: Json
          profile_id: string
          prompt_version?: string | null
          psych_blocking?: Json
          psych_minimums?: Json
          requires_saturdays?: boolean
          salary_expectation_max?: number | null
          salary_is_blocking?: boolean
          schedule_text?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          age_is_blocking?: boolean
          age_max?: number | null
          age_min?: number | null
          commute_max_min?: number | null
          created_at?: string
          cv_threshold?: number
          cv_version?: number
          cv_weights?: Json
          education_min?: string | null
          experience_min_months?: number | null
          generated_at?: string | null
          generated_by_ai?: boolean
          prefilter_questions?: Json
          profile_id?: string
          prompt_version?: string | null
          psych_blocking?: Json
          psych_minimums?: Json
          requires_saturdays?: boolean
          salary_expectation_max?: number | null
          salary_is_blocking?: boolean
          schedule_text?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profile_ai_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      job_profile_assignment_events: {
        Row: {
          action: Database["public"]["Enums"]["assignment_action"]
          actor_user_id: string | null
          created_at: string
          id: string
          profile_id: string
          recruiter_id: string
          source: Database["public"]["Enums"]["assignment_source"]
        }
        Insert: {
          action: Database["public"]["Enums"]["assignment_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          recruiter_id: string
          source?: Database["public"]["Enums"]["assignment_source"]
        }
        Update: {
          action?: Database["public"]["Enums"]["assignment_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          recruiter_id?: string
          source?: Database["public"]["Enums"]["assignment_source"]
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_assignment_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_assignment_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_assignment_events_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profile_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          last_candidate_at: string | null
          profile_id: string
          recruiter_id: string
          turn_seq: number | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          last_candidate_at?: string | null
          profile_id: string
          recruiter_id: string
          turn_seq?: number | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          last_candidate_at?: string | null
          profile_id?: string
          recruiter_id?: string
          turn_seq?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_assignments_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profiles: {
        Row: {
          activities: string[]
          client_id: string
          competencies: Json
          conditions: Json
          created_at: string
          id: string
          intake_id: string | null
          objective: string | null
          openings: number
          posting_text: string | null
          prepared_at: string | null
          prepared_by: string | null
          published_channels: Database["public"]["Enums"]["source_channel"][]
          relations: Json
          reports_to: string | null
          requirements: Json
          selection_process: string[]
          specs: Json
          status: Database["public"]["Enums"]["profile_status"]
          title: string
          unit: string | null
          updated_at: string
          work_zone: string | null
        }
        Insert: {
          activities?: string[]
          client_id: string
          competencies?: Json
          conditions?: Json
          created_at?: string
          id?: string
          intake_id?: string | null
          objective?: string | null
          openings?: number
          posting_text?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          published_channels?: Database["public"]["Enums"]["source_channel"][]
          relations?: Json
          reports_to?: string | null
          requirements?: Json
          selection_process?: string[]
          specs?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          title: string
          unit?: string | null
          updated_at?: string
          work_zone?: string | null
        }
        Update: {
          activities?: string[]
          client_id?: string
          competencies?: Json
          conditions?: Json
          created_at?: string
          id?: string
          intake_id?: string | null
          objective?: string | null
          openings?: number
          posting_text?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          published_channels?: Database["public"]["Enums"]["source_channel"][]
          relations?: Json
          reports_to?: string | null
          requirements?: Json
          selection_process?: string[]
          specs?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          title?: string
          unit?: string | null
          updated_at?: string
          work_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profiles_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "job_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profiles_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_followups: {
        Row: {
          application_id: string
          checkpoint_days: number
          created_at: string
          due_at: string
          id: string
          left_at: string | null
          left_reason: string | null
          notes: string | null
          notified_at: string | null
          outcome: Database["public"]["Enums"]["followup_outcome"]
          recorded_at: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          checkpoint_days: number
          created_at?: string
          due_at: string
          id?: string
          left_at?: string | null
          left_reason?: string | null
          notes?: string | null
          notified_at?: string | null
          outcome?: Database["public"]["Enums"]["followup_outcome"]
          recorded_at?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          checkpoint_days?: number
          created_at?: string
          due_at?: string
          id?: string
          left_at?: string | null
          left_reason?: string | null
          notes?: string | null
          notified_at?: string | null
          outcome?: Database["public"]["Enums"]["followup_outcome"]
          recorded_at?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_followups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_followups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "placement_followups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "placement_followups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "placement_followups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "placement_followups_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prefilter_answers: {
        Row: {
          answer_parsed: Json | null
          answer_raw: string | null
          answered_at: string
          application_id: string
          id: string
          passes: boolean | null
          question_key: string
          question_text: string
          rule_snapshot: Json | null
        }
        Insert: {
          answer_parsed?: Json | null
          answer_raw?: string | null
          answered_at?: string
          application_id: string
          id?: string
          passes?: boolean | null
          question_key: string
          question_text: string
          rule_snapshot?: Json | null
        }
        Update: {
          answer_parsed?: Json | null
          answer_raw?: string | null
          answered_at?: string
          application_id?: string
          id?: string
          passes?: boolean | null
          question_key?: string
          question_text?: string
          rule_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "prefilter_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prefilter_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prefilter_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prefilter_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prefilter_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
        ]
      }
      psychometric_tests: {
        Row: {
          ai_run_id: string | null
          application_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          fit_pct: number | null
          fit_rows: Json | null
          id: string
          parsed: Json | null
          parsed_at: string | null
          provider: string
          reminder_sent_at: string | null
          report_file_path: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["psych_status"]
          test_link: string | null
          updated_at: string
          verdict: Database["public"]["Enums"]["psych_verdict"] | null
        }
        Insert: {
          ai_run_id?: string | null
          application_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          fit_pct?: number | null
          fit_rows?: Json | null
          id?: string
          parsed?: Json | null
          parsed_at?: string | null
          provider?: string
          reminder_sent_at?: string | null
          report_file_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["psych_status"]
          test_link?: string | null
          updated_at?: string
          verdict?: Database["public"]["Enums"]["psych_verdict"] | null
        }
        Update: {
          ai_run_id?: string | null
          application_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          fit_pct?: number | null
          fit_rows?: Json | null
          id?: string
          parsed?: Json | null
          parsed_at?: string | null
          provider?: string
          reminder_sent_at?: string | null
          report_file_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["psych_status"]
          test_link?: string | null
          updated_at?: string
          verdict?: Database["public"]["Enums"]["psych_verdict"] | null
        }
        Relationships: [
          {
            foreignKeyName: "psychometric_tests_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychometric_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychometric_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "psychometric_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "psychometric_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "psychometric_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
        ]
      }
      report_runs: {
        Row: {
          client_id: string | null
          created_at: string
          error: string | null
          html_path: string | null
          id: string
          pdf_path: string | null
          period_end: string
          period_start: string
          recipients: string[]
          resend_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          subject: string | null
          type: Database["public"]["Enums"]["report_type"]
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          html_path?: string | null
          id?: string
          pdf_path?: string | null
          period_end: string
          period_start: string
          recipients?: string[]
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subject?: string | null
          type: Database["public"]["Enums"]["report_type"]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          html_path?: string | null
          id?: string
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          recipients?: string[]
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subject?: string | null
          type?: Database["public"]["Enums"]["report_type"]
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_tasks: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["task_status"]
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["task_status"]
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["task_status"]
          type?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          access_token_enc: string
          account_email: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc: string
          account_email?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string
          account_email?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          ai_paused: boolean
          application_id: string | null
          candidate_id: string
          created_at: string
          flow: Database["public"]["Enums"]["wa_flow"]
          flow_state: Json
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          paused_by: string | null
          phone_e164: string
          status: Database["public"]["Enums"]["wa_conversation_status"]
          updated_at: string
          whaapy_conversation_id: string | null
          window_expires_at: string | null
        }
        Insert: {
          ai_paused?: boolean
          application_id?: string | null
          candidate_id: string
          created_at?: string
          flow?: Database["public"]["Enums"]["wa_flow"]
          flow_state?: Json
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          paused_by?: string | null
          phone_e164: string
          status?: Database["public"]["Enums"]["wa_conversation_status"]
          updated_at?: string
          whaapy_conversation_id?: string | null
          window_expires_at?: string | null
        }
        Update: {
          ai_paused?: boolean
          application_id?: string | null
          candidate_id?: string
          created_at?: string
          flow?: Database["public"]["Enums"]["wa_flow"]
          flow_state?: Json
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          paused_by?: string | null
          phone_e164?: string
          status?: Database["public"]["Enums"]["wa_conversation_status"]
          updated_at?: string
          whaapy_conversation_id?: string | null
          window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "wa_conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "wa_conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "wa_conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_portal_documents"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "wa_conversations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          ai_run_id: string | null
          body: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["wa_direction"]
          error: string | null
          id: string
          interactive_payload: Json | null
          media_mime: string | null
          media_path: string | null
          sent_by: Database["public"]["Enums"]["actor_type"] | null
          sent_by_user_id: string | null
          status: Database["public"]["Enums"]["wa_message_status"]
          type: Database["public"]["Enums"]["wa_message_type"]
          wamid: string | null
          whaapy_message_id: string | null
        }
        Insert: {
          ai_run_id?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["wa_direction"]
          error?: string | null
          id?: string
          interactive_payload?: Json | null
          media_mime?: string | null
          media_path?: string | null
          sent_by?: Database["public"]["Enums"]["actor_type"] | null
          sent_by_user_id?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
          type?: Database["public"]["Enums"]["wa_message_type"]
          wamid?: string | null
          whaapy_message_id?: string | null
        }
        Update: {
          ai_run_id?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_direction"]
          error?: string | null
          id?: string
          interactive_payload?: Json | null
          media_mime?: string | null
          media_path?: string | null
          sent_by?: Database["public"]["Enums"]["actor_type"] | null
          sent_by_user_id?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
          type?: Database["public"]["Enums"]["wa_message_type"]
          wamid?: string | null
          whaapy_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          language: string
          meta_status: string
          name: string
          purpose: Database["public"]["Enums"]["wa_template_purpose"]
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          meta_status?: string
          name: string
          purpose: Database["public"]["Enums"]["wa_template_purpose"]
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          meta_status?: string
          name?: string
          purpose?: Database["public"]["Enums"]["wa_template_purpose"]
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          error: string | null
          event_type: string
          external_id: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          source: Database["public"]["Enums"]["webhook_source"]
        }
        Insert: {
          attempts?: number
          error?: string | null
          event_type: string
          external_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          source: Database["public"]["Enums"]["webhook_source"]
        }
        Update: {
          attempts?: number
          error?: string | null
          event_type?: string
          external_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          source?: Database["public"]["Enums"]["webhook_source"]
        }
        Relationships: []
      }
    }
    Views: {
      v_bi_channel: {
        Row: {
          applications: number | null
          client_id: string | null
          discarded: number | null
          hired: number | null
          prefilter_passed: number | null
          profile_id: string | null
          profile_title: string | null
          source_channel: Database["public"]["Enums"]["source_channel"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bi_discard_reasons: {
        Row: {
          applications: number | null
          client_id: string | null
          discard_reason_key:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          profile_id: string | null
          profile_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bi_funnel: {
        Row: {
          applications: number | null
          client_id: string | null
          profile_id: string | null
          profile_title: string | null
          stage: Database["public"]["Enums"]["application_stage"] | null
          stage_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bi_prefilter_failures: {
        Row: {
          answered: number | null
          client_id: string | null
          failed: number | null
          profile_id: string | null
          profile_title: string | null
          question_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bi_retention: {
        Row: {
          application_id: string | null
          checkpoint_days: number | null
          client_id: string | null
          cv_score: number | null
          due_at: string | null
          full_name: string | null
          hired_at: string | null
          left_at: string | null
          left_reason: string | null
          outcome: Database["public"]["Enums"]["followup_outcome"] | null
          prime_interview_score: number | null
          profile_id: string | null
          profile_title: string | null
          psych_fit_pct: number | null
          psych_verdict: Database["public"]["Enums"]["psych_verdict"] | null
          source_channel: Database["public"]["Enums"]["source_channel"] | null
          start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bi_stage_durations: {
        Row: {
          avg_hours: number | null
          client_id: string | null
          median_hours: number | null
          profile_id: string | null
          profile_title: string | null
          samples: number | null
          stage: Database["public"]["Enums"]["application_stage"] | null
          stage_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inactive_candidates: {
        Row: {
          applications_count: number | null
          best_cv_score: number | null
          candidate_id: string | null
          education_level: string | null
          email: string | null
          full_name: string | null
          last_activity_at: string | null
          last_application_id: string | null
          last_client_name: string | null
          last_discard_reason_key:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          last_discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          last_profile_title: string | null
          last_stage: Database["public"]["Enums"]["application_stage"] | null
          municipality: string | null
          phone_e164: string | null
          was_hired: boolean | null
        }
        Relationships: []
      }
      v_pipeline: {
        Row: {
          age_reported: number | null
          ai_note: string | null
          application_id: string | null
          applied_at: string | null
          assigned_recruiter_id: string | null
          assigned_recruiter_name: string | null
          available: boolean | null
          candidate_id: string | null
          client_decision: Database["public"]["Enums"]["client_decision"] | null
          client_id: string | null
          client_interview_at: string | null
          client_interview_id: string | null
          client_interview_status:
            | Database["public"]["Enums"]["interview_status"]
            | null
          client_name: string | null
          commute_minutes: number | null
          cv_file_path: string | null
          cv_score: number | null
          cv_threshold: number | null
          days_in_stage: number | null
          discard_reason: string | null
          discard_reason_key:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          docs_in_review: number | null
          docs_required: number | null
          docs_validated: number | null
          education_level: string | null
          email: string | null
          experience_months: number | null
          first_name: string | null
          full_name: string | null
          hired_at: string | null
          municipality: string | null
          phone_e164: string | null
          prefilter_status:
            | Database["public"]["Enums"]["prefilter_status"]
            | null
          prime_interview_at: string | null
          prime_interview_id: string | null
          prime_interview_score: number | null
          prime_interview_status:
            | Database["public"]["Enums"]["interview_status"]
            | null
          profile_id: string | null
          profile_title: string | null
          psych_fit_pct: number | null
          psych_status: Database["public"]["Enums"]["psych_status"] | null
          psych_verdict: Database["public"]["Enums"]["psych_verdict"] | null
          salary_expectation: number | null
          source_channel: Database["public"]["Enums"]["source_channel"] | null
          stage: Database["public"]["Enums"]["application_stage"] | null
          stage_changed_at: string | null
          stage_order: number | null
          wa_ai_paused: boolean | null
          wa_last_inbound_at: string | null
          wa_status:
            | Database["public"]["Enums"]["wa_conversation_status"]
            | null
          zone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_portal_applications: {
        Row: {
          application_id: string | null
          applied_at: string | null
          client_decision: Database["public"]["Enums"]["client_decision"] | null
          client_decision_at: string | null
          client_id: string | null
          client_interview_at: string | null
          client_interview_status:
            | Database["public"]["Enums"]["interview_status"]
            | null
          client_interview_url: string | null
          discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          docs_required: number | null
          docs_validated: number | null
          education_level: string | null
          full_name: string | null
          hired_at: string | null
          municipality: string | null
          prime_interview_at: string | null
          prime_interview_score: number | null
          prime_interview_summary: string | null
          profile_id: string | null
          profile_title: string | null
          psych_fit_pct: number | null
          psych_verdict: Database["public"]["Enums"]["psych_verdict"] | null
          stage: Database["public"]["Enums"]["application_stage"] | null
          stage_changed_at: string | null
          stage_order: number | null
          zone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_channel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_discard_reasons"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_funnel"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_prefilter_failures"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_retention"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_bi_stage_durations"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_portal_documents: {
        Row: {
          application_id: string | null
          document_type_key: string | null
          label: string | null
          required: boolean | null
          sort_order: number | null
          status: Database["public"]["Enums"]["doc_status"] | null
          validated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_document_type_key_fkey"
            columns: ["document_type_key"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Functions: {
      blacklist_candidate: {
        Args: {
          p_candidate_id: string
          p_note?: string
          p_reason_key: Database["public"]["Enums"]["blacklist_reason"]
        }
        Returns: {
            added_at: string
            added_by: string | null
            candidate_id: string | null
            created_at: string
            curp: string | null
            email: string | null
            full_name: string
            id: string
            phone_e164: string | null
            reason_key: Database["public"]["Enums"]["blacklist_reason"]
            reason_note: string | null
            removed_at: string | null
            removed_by: string | null
            removed_note: string | null
            updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "candidate_blacklist"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      candidate_history_by_phone: {
        Args: { p_phone: string }
        Returns: {
          application_id: string
          applied_at: string
          candidate_id: string
          client_name: string
          discard_reason_key: Database["public"]["Enums"]["discard_reason_key"]
          is_mine: boolean
          profile_title: string
          recruiter_name: string
          stage: Database["public"]["Enums"]["application_stage"]
          stage_changed_at: string
        }[]
      }
      cancel_scheduled_task: {
        Args: { p_task_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["task_status"]
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "scheduled_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_scheduled_tasks: {
        Args: { p_limit?: number; p_only?: string; p_worker?: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["task_status"]
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      client_decide_application: {
        Args: {
          p_application_id: string
          p_comment?: string
          p_decision: Database["public"]["Enums"]["client_decision"]
        }
        Returns: Json
      }
      enqueue_task: {
        Args: {
          p_dedupe_key?: string
          p_payload?: Json
          p_run_at?: string
          p_type: string
        }
        Returns: string
      }
      find_candidate_by_phone: { Args: { p_phone: string }; Returns: string }
      is_blacklisted: { Args: { p_email?: string; p_phone: string }; Returns: boolean }
      list_user_integrations: {
        Args: never
        Returns: {
          account_email: string
          connected_at: string
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
          user_id: string
        }[]
      }
      record_placement_followup: {
        Args: {
          p_followup_id: string
          p_left_at?: string
          p_left_reason?: string
          p_notes?: string
          p_outcome: Database["public"]["Enums"]["followup_outcome"]
        }
        Returns: {
          application_id: string
          checkpoint_days: number
          created_at: string
          due_at: string
          id: string
          left_at: string | null
          left_reason: string | null
          notes: string | null
          notified_at: string | null
          outcome: Database["public"]["Enums"]["followup_outcome"]
          recorded_at: string | null
          recorded_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "placement_followups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_blacklist_attempt: {
        Args: { p_email?: string; p_phone: string; p_profile_id?: string }
        Returns: number
      }
      finish_scheduled_task: {
        Args: { p_error?: string; p_ok: boolean; p_retry?: boolean; p_task_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["task_status"]
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "scheduled_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_entity_id: string | null
          p_entity_type: string
          p_ip?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      notify_followups_due: { Args: never; Returns: number }
      notify_staff: {
        Args: {
          p_body?: string
          p_entity_id?: string
          p_entity_type?: string
          p_href?: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_title: string
        }
        Returns: number
      }
      set_profile_recruiters: {
        Args: { p_profile_id: string; p_recruiter_ids: string[] }
        Returns: number
      }
      unblacklist_candidate: {
        Args: { p_entry_id: string; p_note?: string }
        Returns: {
            added_at: string
            added_by: string | null
            candidate_id: string | null
            created_at: string
            curp: string | null
            email: string | null
            full_name: string
            id: string
            phone_e164: string | null
            reason_key: Database["public"]["Enums"]["blacklist_reason"]
            reason_note: string | null
            removed_at: string | null
            removed_by: string | null
            removed_note: string | null
            updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "candidate_blacklist"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retry_scheduled_task: {
        Args: { p_task_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["task_status"]
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "scheduled_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_application_stage: {
        Args: {
          p_actor_type?: Database["public"]["Enums"]["actor_type"]
          p_application_id: string
          p_discard_reason_key?: Database["public"]["Enums"]["discard_reason_key"]
          p_reason?: string
          p_to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Returns: {
          agreed_salary: number | null
          ai_note: string | null
          applied_at: string
          assigned_at: string | null
          assigned_recruiter_id: string | null
          availability_notes: string | null
          available: boolean | null
          candidate_id: string
          client_decision: Database["public"]["Enums"]["client_decision"] | null
          client_decision_at: string | null
          client_decision_by: string | null
          client_decision_comment: string | null
          commute_minutes: number | null
          confirmation_sheet_path: string | null
          confirmation_signed_at: string | null
          created_at: string
          cv_ai_rationale: string | null
          cv_score: number | null
          cv_score_breakdown: Json | null
          cv_score_version: number | null
          cv_scored_at: string | null
          discard_reason: string | null
          discard_reason_key:
            | Database["public"]["Enums"]["discard_reason_key"]
            | null
          discarded_at: string | null
          discarded_by: Database["public"]["Enums"]["actor_type"] | null
          discarded_by_user_id: string | null
          discarded_from_stage:
            | Database["public"]["Enums"]["application_stage"]
            | null
          experience_months: number | null
          hired_at: string | null
          id: string
          import_batch_id: string | null
          prefilter_result: Json | null
          prefilter_status: Database["public"]["Enums"]["prefilter_status"]
          profile_id: string
          salary_expectation: number | null
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["application_stage"]
          stage_changed_at: string
          start_date: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      actor_type: "agent" | "recruiter" | "client" | "system"
      ai_run_kind:
        | "profile_generation"
        | "cv_score"
        | "prefilter_reply"
        | "interview_analysis"
        | "psych_parse"
        | "doc_check"
        | "weekly_insights"
        | "cv_extract"
      ai_run_status: "ok" | "error" | "refusal"
      application_stage:
        | "new"
        | "prefilter"
        | "cv_review"
        | "prime_interview"
        | "psychometric"
        | "documents"
        | "client_interview"
        | "hired"
        | "discarded"
      assignment_action: "assigned" | "unassigned"
      assignment_source: "manual" | "user_deactivated" | "role_changed"
      blacklist_reason:
        | "theft"
        | "abandonment"
        | "fake_documents"
        | "misconduct"
        | "other"
      audit_action:
        | "view_cv"
        | "view_document"
        | "download_document"
        | "view_psych_report"
        | "export"
        | "edit_profile"
      client_decision: "approve" | "reject"
      discard_reason_key:
        | "age"
        | "commute"
        | "salary"
        | "schedule"
        | "experience"
        | "education"
        | "no_response"
        | "invalid_phone"
        | "cv_score"
        | "interview"
        | "psychometric"
        | "documents"
        | "client_rejected"
        | "withdrew"
        | "other"
      doc_status:
        | "pending"
        | "received"
        | "in_review"
        | "validated"
        | "rejected"
      followup_outcome: "pending" | "active" | "left" | "unknown"
      import_status: "pending" | "processing" | "done" | "failed"
      intake_status: "draft" | "generated"
      integration_provider: "google" | "microsoft"
      interview_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "no_show"
        | "cancelled"
        | "recorded"
        | "transcribed"
        | "analyzed"
      interview_type: "prime" | "client"
      meeting_platform: "meet" | "zoom" | "teams"
      notification_kind:
        | "client_decision"
        | "prefilter_exception"
        | "document_received"
        | "interview_analyzed"
        | "psych_parsed"
        | "candidate_hired"
        | "task_failed"
        | "other"
        | "followup_due"
        | "candidate_assigned"
        | "interview_scheduled"
        | "blacklist_attempt"
      prefilter_status:
        | "pending"
        | "in_progress"
        | "passed"
        | "failed"
        | "exception"
      profile_status: "intake" | "active" | "paused" | "closed"
      psych_status: "pending" | "sent" | "completed" | "parsed" | "failed"
      psych_verdict: "fit" | "fit_with_reservations" | "not_recommended"
      received_via: "whatsapp" | "upload" | "email"
      report_status: "pending" | "rendered" | "sent" | "failed"
      report_type: "daily_internal" | "daily_client" | "weekly_client"
      source_channel:
        | "pandape"
        | "facebook"
        | "linkedin"
        | "prime_pool"
        | "referral"
        | "other"
      task_status: "pending" | "running" | "done" | "failed" | "cancelled"
      user_role: "admin" | "recruiter" | "client"
      wa_conversation_status:
        | "open"
        | "closed_success"
        | "closed_rule"
        | "handoff"
        | "expired"
      wa_direction: "inbound" | "outbound"
      wa_flow:
        | "prefilter"
        | "scheduling"
        | "psychometric"
        | "documents"
        | "reminder"
        | "manual"
      wa_message_status: "queued" | "sent" | "delivered" | "read" | "failed"
      wa_message_type:
        | "text"
        | "image"
        | "document"
        | "audio"
        | "video"
        | "template"
        | "interactive"
      wa_template_purpose:
        | "first_contact"
        | "interview_confirm"
        | "psych_link"
        | "docs_request"
        | "reminder"
        | "courtesy_close"
      webhook_source: "whaapy" | "fireflies" | "resend" | "google" | "microsoft"
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
      actor_type: ["agent", "recruiter", "client", "system"],
      ai_run_kind: [
        "profile_generation",
        "cv_score",
        "prefilter_reply",
        "interview_analysis",
        "psych_parse",
        "doc_check",
        "weekly_insights",
        "cv_extract",
      ],
      ai_run_status: ["ok", "error", "refusal"],
      application_stage: [
        "new",
        "prefilter",
        "cv_review",
        "prime_interview",
        "psychometric",
        "documents",
        "client_interview",
        "hired",
        "discarded",
      ],
      assignment_action: ["assigned", "unassigned"],
      assignment_source: ["manual", "user_deactivated", "role_changed"],
      blacklist_reason: [
        "theft",
        "abandonment",
        "fake_documents",
        "misconduct",
        "other",
      ],
      audit_action: [
        "view_cv",
        "view_document",
        "download_document",
        "view_psych_report",
        "export",
        "edit_profile",
      ],
      client_decision: ["approve", "reject"],
      discard_reason_key: [
        "age",
        "commute",
        "salary",
        "schedule",
        "experience",
        "education",
        "no_response",
        "invalid_phone",
        "cv_score",
        "interview",
        "psychometric",
        "documents",
        "client_rejected",
        "withdrew",
        "other",
      ],
      doc_status: ["pending", "received", "in_review", "validated", "rejected"],
      followup_outcome: ["pending", "active", "left", "unknown"],
      import_status: ["pending", "processing", "done", "failed"],
      intake_status: ["draft", "generated"],
      integration_provider: ["google", "microsoft"],
      interview_status: [
        "scheduled",
        "confirmed",
        "completed",
        "no_show",
        "cancelled",
        "recorded",
        "transcribed",
        "analyzed",
      ],
      interview_type: ["prime", "client"],
      meeting_platform: ["meet", "zoom", "teams"],
      notification_kind: [
        "client_decision",
        "prefilter_exception",
        "document_received",
        "interview_analyzed",
        "psych_parsed",
        "candidate_hired",
        "task_failed",
        "other",
        "followup_due",
        "candidate_assigned",
        "interview_scheduled",
        "blacklist_attempt",
      ],
      prefilter_status: [
        "pending",
        "in_progress",
        "passed",
        "failed",
        "exception",
      ],
      profile_status: ["intake", "active", "paused", "closed"],
      psych_status: ["pending", "sent", "completed", "parsed", "failed"],
      psych_verdict: ["fit", "fit_with_reservations", "not_recommended"],
      received_via: ["whatsapp", "upload", "email"],
      report_status: ["pending", "rendered", "sent", "failed"],
      report_type: ["daily_internal", "daily_client", "weekly_client"],
      source_channel: [
        "pandape",
        "facebook",
        "linkedin",
        "prime_pool",
        "referral",
        "other",
      ],
      task_status: ["pending", "running", "done", "failed", "cancelled"],
      user_role: ["admin", "recruiter", "client"],
      wa_conversation_status: [
        "open",
        "closed_success",
        "closed_rule",
        "handoff",
        "expired",
      ],
      wa_direction: ["inbound", "outbound"],
      wa_flow: [
        "prefilter",
        "scheduling",
        "psychometric",
        "documents",
        "reminder",
        "manual",
      ],
      wa_message_status: ["queued", "sent", "delivered", "read", "failed"],
      wa_message_type: [
        "text",
        "image",
        "document",
        "audio",
        "video",
        "template",
        "interactive",
      ],
      wa_template_purpose: [
        "first_contact",
        "interview_confirm",
        "psych_link",
        "docs_request",
        "reminder",
        "courtesy_close",
      ],
      webhook_source: ["whaapy", "fireflies", "resend", "google", "microsoft"],
    },
  },
} as const

