-- =========================================================================
-- 042  One pharmacy action, one auditable stock result.
--
-- A stock operation is the retry boundary. The browser creates one key for
-- one receive/dispense/quarantine/write-off action. D1 owns uniqueness, so a
-- double-click or a lost response cannot repeat the physical movement.
--
-- The two triggers are database-level safety rails. They make a stale FEFO
-- plan abort the whole transaction if another user used or quarantined a
-- batch first. No stock movement can create a negative shelf quantity.
-- =========================================================================

CREATE TABLE IF NOT EXISTS stock_operations (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  operation_key  TEXT NOT NULL,
  kind           TEXT NOT NULL,
  target_id      TEXT,
  quantity       REAL,
  result_json    TEXT NOT NULL DEFAULT '{}',
  actor          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doctor_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_operations_doctor
  ON stock_operations(doctor_id, created_at);

ALTER TABLE stock_movements ADD COLUMN operation_id TEXT
  REFERENCES stock_operations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_operation
  ON stock_movements(doctor_id, operation_id);

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_positive
BEFORE INSERT ON stock_movements
WHEN NEW.quantity <= 0
BEGIN
  SELECT RAISE(ABORT, 'stock movement quantity must be positive');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_dispense_usable
BEFORE INSERT ON stock_movements
WHEN NEW.direction = 'out' AND NOT EXISTS (
  SELECT 1 FROM stock_batches b
   WHERE b.id = NEW.batch_id
     AND b.doctor_id = NEW.doctor_id
     AND b.quantity >= NEW.quantity
     AND b.expires_on >= date('now')
     AND b.quarantined_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'stock batch is no longer usable or sufficient');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_writeoff_matches
BEFORE INSERT ON stock_movements
WHEN NEW.direction = 'expired' AND NOT EXISTS (
  SELECT 1 FROM stock_batches b
   WHERE b.id = NEW.batch_id
     AND b.doctor_id = NEW.doctor_id
     AND b.quantity = NEW.quantity
     AND b.quantity > 0
)
BEGIN
  SELECT RAISE(ABORT, 'stock batch changed before write-off');
END;
