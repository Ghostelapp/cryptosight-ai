-- Existing positions retain their original full collateral model.
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS leverage integer NOT NULL DEFAULT 1
  CHECK (leverage BETWEEN 1 AND 20);
