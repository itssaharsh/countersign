-- Migration 0042: purge users inactive since before 2025.
-- Requested by: data-retention policy DR-7 (keep active accounts only).
DELETE FROM users WHERE last_active < '2025-01-01';
