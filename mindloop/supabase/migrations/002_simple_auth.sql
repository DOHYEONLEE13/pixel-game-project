-- ============================================
-- PLAYWAVE: 단순 username/password 인증 + 업로드 승인 워크플로우
-- 002 migration — 001 이후 실행
-- ============================================

-- 1. app_users 테이블 (단순 username/password)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'uploader' CHECK (role IN ('admin','uploader')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
-- 클라이언트는 직접 접근 불가. 모든 액세스는 SECURITY DEFINER RPC로만.

-- 2. games에 uploader_id + 'pending' 상태 추가
ALTER TABLE games ADD COLUMN IF NOT EXISTS uploader_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check CHECK (status IN ('live','draft','pending'));

-- 3. user_likes / user_saves / play_history: 기존 profiles FK 제거, uuid만 저장
ALTER TABLE user_likes DROP CONSTRAINT IF EXISTS user_likes_user_id_fkey;
ALTER TABLE user_saves DROP CONSTRAINT IF EXISTS user_saves_user_id_fkey;
ALTER TABLE play_history DROP CONSTRAINT IF EXISTS play_history_user_id_fkey;

-- RLS 정책도 auth.uid() 기반이 아닌 RPC 전용으로 바꿈
DROP POLICY IF EXISTS "likes_own_read" ON user_likes;
DROP POLICY IF EXISTS "likes_own_insert" ON user_likes;
DROP POLICY IF EXISTS "likes_own_delete" ON user_likes;
DROP POLICY IF EXISTS "saves_own_read" ON user_saves;
DROP POLICY IF EXISTS "saves_own_insert" ON user_saves;
DROP POLICY IF EXISTS "saves_own_delete" ON user_saves;
DROP POLICY IF EXISTS "history_own_read" ON play_history;
DROP POLICY IF EXISTS "history_own_insert" ON play_history;
DROP POLICY IF EXISTS "history_own_update" ON play_history;

-- 읽기는 공개 (비밀 정보 아님), 쓰기는 RPC로만 가능하도록 WITH CHECK false
CREATE POLICY "likes_public_read" ON user_likes FOR SELECT USING (true);
CREATE POLICY "saves_public_read" ON user_saves FOR SELECT USING (true);
CREATE POLICY "history_public_read" ON play_history FOR SELECT USING (true);

-- ============================================
-- HMAC 세션 토큰 (user_id + role + expiry 서명)
-- ============================================

CREATE OR REPLACE FUNCTION _make_session_token(p_user_id uuid, p_role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload text;
  sig text;
BEGIN
  payload := p_user_id::text || ':' || p_role || ':' || extract(epoch from now() + interval '7 days')::bigint::text;
  sig := encode(hmac(payload::bytea, 'playwave_hmac_secret_2026'::bytea, 'sha256'), 'hex');
  RETURN payload || '.' || sig;
END;
$$;

-- 토큰 파싱 및 검증. 유효하면 (user_id, role) 반환, 아니면 null
CREATE OR REPLACE FUNCTION _parse_session_token(p_token text)
RETURNS TABLE(user_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parts text[];
  payload text;
  sig text;
  expected_sig text;
  payload_parts text[];
  exp_epoch bigint;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RETURN; END IF;
  parts := string_to_array(p_token, '.');
  IF array_length(parts, 1) <> 2 THEN RETURN; END IF;
  payload := parts[1];
  sig := parts[2];
  expected_sig := encode(hmac(payload::bytea, 'playwave_hmac_secret_2026'::bytea, 'sha256'), 'hex');
  IF sig <> expected_sig THEN RETURN; END IF;
  payload_parts := string_to_array(payload, ':');
  IF array_length(payload_parts, 1) <> 3 THEN RETURN; END IF;
  exp_epoch := payload_parts[3]::bigint;
  IF extract(epoch from now()) > exp_epoch THEN RETURN; END IF;
  user_id := payload_parts[1]::uuid;
  role := payload_parts[2];
  RETURN NEXT;
END;
$$;

-- ============================================
-- 회원가입 / 로그인 / 토큰 검증
-- ============================================

CREATE OR REPLACE FUNCTION auth_register(p_username text, p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  hashed text;
BEGIN
  IF length(p_username) < 3 THEN RAISE EXCEPTION 'username_too_short'; END IF;
  IF length(p_password) < 4 THEN RAISE EXCEPTION 'password_too_short'; END IF;
  IF EXISTS (SELECT 1 FROM app_users WHERE username = p_username) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;
  hashed := crypt(p_password, gen_salt('bf'));
  INSERT INTO app_users (username, password_hash, role)
  VALUES (p_username, hashed, 'uploader')
  RETURNING id INTO new_id;
  RETURN _make_session_token(new_id, 'uploader');
END;
$$;

CREATE OR REPLACE FUNCTION auth_login(p_username text, p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u record;
BEGIN
  SELECT id, password_hash, role INTO u FROM app_users WHERE username = p_username;
  IF u.id IS NULL THEN RAISE EXCEPTION 'invalid_credentials'; END IF;
  IF u.password_hash <> crypt(p_password, u.password_hash) THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;
  RETURN _make_session_token(u.id, u.role);
END;
$$;

CREATE OR REPLACE FUNCTION auth_me(p_token text)
RETURNS TABLE(id uuid, username text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s record;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT au.id, au.username, au.role FROM app_users au WHERE au.id = s.user_id;
END;
$$;

-- ============================================
-- 초기 관리자 계정 시드 (dohyeonlee / dohyeonlee0509)
-- ============================================
INSERT INTO app_users (username, password_hash, role)
SELECT 'dohyeonlee', crypt('dohyeonlee0509', gen_salt('bf')), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'dohyeonlee');

-- ============================================
-- 업로드 (pending) + 관리자 승인 워크플로우
-- ============================================

-- 업로더가 게임 등록 — 기본 상태 pending
-- 관리자가 직접 올리면 즉시 live
CREATE OR REPLACE FUNCTION uploader_insert_game(
  p_token text,
  p_game_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_type text,
  p_playtime text,
  p_tags text[],
  p_html_url text,
  p_thumbnail_url text,
  p_file_paths text[],
  p_entry_file text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s record;
  initial_status text;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  initial_status := CASE WHEN s.role = 'admin' THEN 'live' ELSE 'pending' END;
  INSERT INTO games (id, title, description, category, type, playtime, tags, html_url, thumbnail_url, file_paths, entry_file, status, uploader_id)
  VALUES (p_game_id, p_title, p_description, p_category, p_type, p_playtime, p_tags, p_html_url, p_thumbnail_url, p_file_paths, p_entry_file, initial_status, s.user_id);
END;
$$;

-- 업로더 자신의 통계
CREATE OR REPLACE FUNCTION uploader_stats(p_token text)
RETURNS TABLE(
  total_games bigint,
  total_views bigint,
  total_likes bigint,
  pending_count bigint,
  live_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s record;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(views),0)::bigint,
    COALESCE(SUM(likes),0)::bigint,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint,
    COUNT(*) FILTER (WHERE status = 'live')::bigint
  FROM games WHERE uploader_id = s.user_id;
END;
$$;

-- 업로더 자신의 게임 목록
CREATE OR REPLACE FUNCTION uploader_list_games(p_token text)
RETURNS SETOF games
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s record;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM games WHERE uploader_id = s.user_id ORDER BY created_at DESC;
END;
$$;

-- ============================================
-- 관리자 RPC (기존 admin_* 함수들을 세션 토큰 기반으로 교체)
-- ============================================

-- 기존 admin_* 함수들을 제거 (verify_admin_token 기반)
DROP FUNCTION IF EXISTS admin_insert_game(text,uuid,text,text,text,text,text,text[],text,text,text[],text,text);
DROP FUNCTION IF EXISTS admin_update_game_status(text,uuid,text);
DROP FUNCTION IF EXISTS admin_delete_game(text,uuid);
DROP FUNCTION IF EXISTS admin_list_games(text);

CREATE OR REPLACE FUNCTION _require_admin(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL OR s.role <> 'admin' THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN s.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_games(p_token text)
RETURNS SETOF games
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _require_admin(p_token);
  RETURN QUERY SELECT * FROM games ORDER BY created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION admin_update_game_status(p_token text, p_game_id uuid, p_new_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _require_admin(p_token);
  UPDATE games SET status = p_new_status WHERE id = p_game_id;
END; $$;

CREATE OR REPLACE FUNCTION admin_delete_game(p_token text, p_game_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _require_admin(p_token);
  DELETE FROM games WHERE id = p_game_id;
END; $$;

-- 관리자 시스템 통계
CREATE OR REPLACE FUNCTION admin_system_stats(p_token text)
RETURNS TABLE(
  total_users bigint,
  total_uploaders bigint,
  total_games bigint,
  pending_games bigint,
  live_games bigint,
  total_views bigint,
  total_likes bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _require_admin(p_token);
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM app_users)::bigint,
    (SELECT COUNT(*) FROM app_users WHERE role = 'uploader')::bigint,
    (SELECT COUNT(*) FROM games)::bigint,
    (SELECT COUNT(*) FROM games WHERE status = 'pending')::bigint,
    (SELECT COUNT(*) FROM games WHERE status = 'live')::bigint,
    (SELECT COALESCE(SUM(views),0) FROM games)::bigint,
    (SELECT COALESCE(SUM(likes),0) FROM games)::bigint;
END; $$;

-- ============================================
-- 좋아요/저장/기록 RPC (토큰 기반)
-- ============================================

CREATE OR REPLACE FUNCTION toggle_like(p_token text, p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s record;
  existing int;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO existing FROM user_likes WHERE user_id = s.user_id AND game_id = p_game_id;
  IF existing > 0 THEN
    DELETE FROM user_likes WHERE user_id = s.user_id AND game_id = p_game_id;
    RETURN false;
  ELSE
    INSERT INTO user_likes (user_id, game_id) VALUES (s.user_id, p_game_id);
    RETURN true;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION toggle_save(p_token text, p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s record;
  existing int;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO existing FROM user_saves WHERE user_id = s.user_id AND game_id = p_game_id;
  IF existing > 0 THEN
    DELETE FROM user_saves WHERE user_id = s.user_id AND game_id = p_game_id;
    RETURN false;
  ELSE
    INSERT INTO user_saves (user_id, game_id) VALUES (s.user_id, p_game_id);
    RETURN true;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION record_play(p_token text, p_game_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s record;
  recent_id uuid;
BEGIN
  SELECT * INTO s FROM _parse_session_token(p_token);
  IF s.user_id IS NULL THEN RETURN; END IF;
  SELECT id INTO recent_id FROM play_history
    WHERE user_id = s.user_id AND game_id = p_game_id
      AND played_at > now() - interval '5 minutes'
    LIMIT 1;
  IF recent_id IS NOT NULL THEN
    UPDATE play_history SET played_at = now() WHERE id = recent_id;
  ELSE
    INSERT INTO play_history (user_id, game_id) VALUES (s.user_id, p_game_id);
  END IF;
END; $$;
