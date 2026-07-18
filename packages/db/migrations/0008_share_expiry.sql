-- 0008_share_expiry: optional expiry on a share link (#34). NULL = never expires. A share whose
-- expires_at is in the past is refused at resolve time, so the deployed mock and its comment routes
-- 404 for an expired token.
ALTER TABLE shares ADD COLUMN expires_at TEXT;
