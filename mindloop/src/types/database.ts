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
          status: "live" | "draft" | "pending";
          html_url: string | null;
          thumbnail_url: string | null;
          file_paths: string[] | null;
          entry_file: string | null;
          uploader_id: string | null;
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
      auth_login: { Args: { p_username: string; p_password: string }; Returns: string };
      auth_register: { Args: { p_username: string; p_password: string }; Returns: string };
      auth_me: {
        Args: { p_token: string };
        Returns: { id: string; username: string; role: "admin" | "uploader" }[];
      };
      increment_views: { Args: { game_id_input: string }; Returns: void };
      toggle_like: { Args: { p_token: string; p_game_id: string }; Returns: boolean };
      toggle_save: { Args: { p_token: string; p_game_id: string }; Returns: boolean };
      record_play: { Args: { p_token: string; p_game_id: string }; Returns: void };
      uploader_insert_game: {
        Args: {
          p_token: string;
          p_game_id: string;
          p_title: string;
          p_description: string | null;
          p_category: string;
          p_type: string;
          p_playtime: string | null;
          p_tags: string[] | null;
          p_html_url: string | null;
          p_thumbnail_url: string | null;
          p_file_paths: string[] | null;
          p_entry_file: string | null;
        };
        Returns: void;
      };
      uploader_stats: {
        Args: { p_token: string };
        Returns: {
          total_games: number;
          total_views: number;
          total_likes: number;
          pending_count: number;
          live_count: number;
        }[];
      };
      uploader_list_games: { Args: { p_token: string }; Returns: Game[] };
      admin_list_games: { Args: { p_token: string }; Returns: Game[] };
      admin_update_game_status: {
        Args: { p_token: string; p_game_id: string; p_new_status: string };
        Returns: void;
      };
      admin_delete_game: { Args: { p_token: string; p_game_id: string }; Returns: void };
      admin_system_stats: {
        Args: { p_token: string };
        Returns: {
          total_users: number;
          total_uploaders: number;
          total_games: number;
          pending_games: number;
          live_games: number;
          total_views: number;
          total_likes: number;
        }[];
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
