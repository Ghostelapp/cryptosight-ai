ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS initial_quantity numeric(30,12);
UPDATE paper_orders SET initial_quantity=quantity WHERE initial_quantity IS NULL;
ALTER TABLE paper_orders ALTER COLUMN initial_quantity SET NOT NULL;
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS stop_loss numeric(30,12) CHECK(stop_loss>0);
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS take_profit numeric(30,12) CHECK(take_profit>0);
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS reserved numeric(30,12) NOT NULL DEFAULT 0 CHECK(reserved>=0);
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS request_fingerprint text;
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS pending_exit text;
ALTER TABLE paper_orders ADD COLUMN IF NOT EXISTS close_reason text;
CREATE TABLE IF NOT EXISTS paper_exits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES paper_orders(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), quantity numeric(30,12) NOT NULL CHECK(quantity>0),
 price numeric(30,12) NOT NULL CHECK(price>0), pnl numeric(30,12) NOT NULL,
 entry_fees numeric(30,12) NOT NULL, exit_fees numeric(30,12) NOT NULL,
 reason text NOT NULL, idempotency_key text NOT NULL, UNIQUE(order_id,idempotency_key)
);
INSERT INTO paper_exits(order_id,quantity,price,pnl,entry_fees,exit_fees,reason,idempotency_key)
 SELECT id,quantity,close_price,pnl,fees,close_price*quantity*0.001,'manual','legacy' FROM paper_orders
 WHERE status='closed' AND close_price IS NOT NULL ON CONFLICT DO NOTHING;
UPDATE paper_exits e SET created_at=o.closed_at FROM paper_orders o WHERE e.order_id=o.id AND e.idempotency_key='legacy';
CREATE INDEX IF NOT EXISTS paper_active_idx ON paper_orders(status) WHERE status IN ('pending','filled');
CREATE INDEX IF NOT EXISTS paper_exits_order_idx ON paper_exits(order_id,created_at);
CREATE TABLE IF NOT EXISTS paper_engine_health (id integer PRIMARY KEY CHECK(id=1), last_tick timestamptz NOT NULL);

ALTER TABLE paper_accounts ALTER COLUMN currency SET DEFAULT 'USDT';
UPDATE paper_accounts SET currency='USDT' WHERE currency='USD';
