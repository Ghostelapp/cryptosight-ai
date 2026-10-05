ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS collateral_exhausted boolean NOT NULL DEFAULT false;
