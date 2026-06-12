export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      repos: {
        Row: {
          id: string;
          name: string;
          full_name: string;
          description: string | null;
          language: string;
          stars: number;
          updated_at: string;
          private: boolean;
          framework: string;
          owner: string | null;
          default_branch: string | null;
        };
        Insert: {
          id: string;
          name: string;
          full_name: string;
          description?: string | null;
          language?: string;
          stars?: number;
          updated_at?: string;
          private?: boolean;
          framework?: string;
          owner?: string | null;
          default_branch?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["repos"]["Insert"]>;
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          repo_id: string;
          score: number;
          created_at: string;
          warnings: string | null;
        };
        Insert: {
          id: string;
          repo_id: string;
          score: number;
          created_at?: string;
          warnings?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["scans"]["Insert"]>;
        Relationships: [];
      };
      issues: {
        Row: {
          id: string;
          scan_id: string;
          category: string;
          title: string;
          severity: string;
          why: string;
          time_saved: string;
          fix_id: string;
        };
        Insert: Database["public"]["Tables"]["issues"]["Row"];
        Update: Partial<Database["public"]["Tables"]["issues"]["Insert"]>;
        Relationships: [];
      };
      fix_requests: {
        Row: {
          id: string;
          repo_id: string;
          scan_id: string;
          fixes: string;
          status: string;
          branch_name: string;
          pr_number: number | null;
          pr_url: string | null;
          error_message: string | null;
          est_files_added: number;
          est_files_changed: number;
          est_deps: number;
          credits_cost: number;
          owner_login: string | null;
          ai_files: string | null;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          repo_id: string;
          scan_id: string;
          fixes: string;
          status?: string;
          branch_name: string;
          pr_number?: number | null;
          pr_url?: string | null;
          error_message?: string | null;
          est_files_added?: number;
          est_files_changed?: number;
          est_deps?: number;
          credits_cost?: number;
          owner_login?: string | null;
          ai_files?: string | null;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fix_requests"]["Insert"]>;
        Relationships: [];
      };
      user_credits: {
        Row: {
          github_login: string;
          balance: number;
          updated_at: string;
          plan: string;
          monthly_scan_limit: number;
          monthly_scan_used: number;
          ai_credits_total: number;
          current_period_start: string;
          current_period_end: string;
          created_at: string;
          is_admin: boolean;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          email_unsubscribed: boolean;
          email: string | null;
          subscription_cancel_at: string | null;
          trial_credits_total: number;
          trial_credits_used: number;
        };
        Insert: {
          github_login: string;
          balance?: number;
          updated_at?: string;
          plan?: string;
          monthly_scan_limit?: number;
          monthly_scan_used?: number;
          ai_credits_total?: number;
          current_period_start?: string;
          current_period_end?: string;
          created_at?: string;
          is_admin?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          email_unsubscribed?: boolean;
          email?: string | null;
          subscription_cancel_at?: string | null;
          trial_credits_total?: number;
          trial_credits_used?: number;
        };
        Update: Partial<Database["public"]["Tables"]["user_credits"]["Insert"]>;
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          github_login: string;
          amount: number;
          reason: string;
          type: string;
          job_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          github_login: string;
          amount: number;
          reason: string;
          type?: string;
          job_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credit_transactions"]["Insert"]>;
        Relationships: [];
      };
      arch_scans: {
        Row: {
          id: string;
          repo_id: string;
          score: number;
          findings: string;
          scanned_files: number;
          created_at: string;
        };
        Insert: {
          id: string;
          repo_id: string;
          score: number;
          findings: string;
          scanned_files?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["arch_scans"]["Insert"]>;
        Relationships: [];
      };
      ai_test_cache: {
        Row: {
          id: string;
          scan_id: string;
          fix_ids: string;
          result: string;
          content_hash: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          scan_id: string;
          fix_ids: string;
          result: string;
          content_hash?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_test_cache"]["Insert"]>;
        Relationships: [];
      };
      fix_cache: {
        Row: {
          id: string;
          repo_id: string;
          fix_ids: string;
          framework: string;
          files_json: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          repo_id: string;
          fix_ids: string;
          framework?: string;
          files_json: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fix_cache"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
