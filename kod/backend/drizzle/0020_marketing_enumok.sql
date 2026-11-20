-- SPEC §31.7 (marketing, 2026-11-20): enum value only – the cookie notice (jogi/suti.md). Nothing in this run may USE the
-- value in the same transaction (Postgres rule; §26.9.1). The legal store reads index.json at start; until suti.md is in
-- index.json the type gets the marked placeholder text.
ALTER TYPE "public"."legal_doc_type" ADD VALUE IF NOT EXISTS 'suti';
