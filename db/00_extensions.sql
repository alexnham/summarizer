-- 00_extensions.sql
-- Enable helper extensions required by the schema
create extension if not exists "pgcrypto";
create extension if not exists "citext";
