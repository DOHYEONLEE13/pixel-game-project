export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string;
          type: "shortform" | "longform";
          playtime: string | null;
          tags: string[] | null;
          views: number;
          likes: number;
          status: "live" | "draft";
          html_url: string | null;
          thumbnail_url: string | null;
          file_paths: string[] | null;
          entry_file: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category: string;
          type: "shortform" | "longform";
          playtime?: string | null;
          tags?: string[] | null;
          views?: number;
          likes?: number;
          status?: "live" | "draft";
          html_url?: string | null;
          thumbnail_url?: string | null;
          file_paths?: string[] | null;
          entry_file?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          nickname: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      user_likes: {
        Row: {
          user_id: string;
          game_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          game_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_likes"]["Insert"]>;
      };
      user_saves: {
        Row: {
          user_id: string;
          game_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          game_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_saves"]["Insert"]>;
      };
      play_history: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          played_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          played_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["play_history"]["Insert"]>;
      };
    };
    Functions: {
      verify_admin_password: {
        Args: { password_input: string };
        Returns: string;
      };
      verify_admin_token: {
        Args: { token_input: string };
        Returns: boolean;
      };
      increment_views: {
        Args: { game_id_input: string };
        Returns: void;
      };
    };
  };
}

// Convenience type aliases
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserLike = Database["public"]["Tables"]["user_likes"]["Row"];
export type UserSave = Database["public"]["Tables"]["user_saves"]["Row"];
export type PlayHistory = Database["public"]["Tables"]["play_history"]["Row"];
