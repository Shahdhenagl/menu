-- Patch 3: Financial Transactions Ledger (Fund Transfers & Debt Settlements)

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('fund_transfer', 'debt_settlement')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  from_method TEXT,
  to_method TEXT,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON financial_transactions;
CREATE POLICY "Allow all for everyone" ON financial_transactions FOR ALL USING (true) WITH CHECK (true);
