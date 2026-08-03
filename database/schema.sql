-- Create enum types for strict validation
CREATE TYPE payment_method_type AS ENUM ('telebirr', 'cbe');
CREATE TYPE payment_status_type AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_proof_status_type AS ENUM ('pending_admin', 'approved', 'rejected');

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Assuming usage of auth.users; add "REFERENCES auth.users(id)" if desired
    total_amount NUMERIC NOT NULL,
    payment_method payment_method_type NOT NULL,
    payment_status payment_status_type NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bank SMS Logs Table
CREATE TABLE IF NOT EXISTS bank_sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT NOT NULL,
    raw_message TEXT NOT NULL,
    extracted_txn_id TEXT UNIQUE,
    extracted_amount NUMERIC,
    extracted_date TIMESTAMP,
    is_matched BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Payment Proofs Table
CREATE TABLE IF NOT EXISTS payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    screenshot_url TEXT NOT NULL,
    ocr_txn_id TEXT,
    ocr_amount NUMERIC,
    ocr_date TIMESTAMP,
    status payment_proof_status_type NOT NULL DEFAULT 'pending_admin',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Automated SMS Parser Function
CREATE OR REPLACE FUNCTION process_bank_sms()
RETURNS TRIGGER AS $$
DECLARE
    txn_id TEXT;
    amt_text TEXT;
    amt NUMERIC;
BEGIN
    -- Handle Telebirr Regex
    IF NEW.sender ILIKE '%telebirr%' THEN
        -- Extract amount from "received ETB [amount]"
        amt_text := substring(NEW.raw_message from 'received ETB ([0-9,.]+)');
        -- Extract transaction number from "transaction number is [txn_id]"
        txn_id := substring(NEW.raw_message from 'transaction number is ([A-Z0-9]+)');
        
    -- Handle CBE / CBE Birr Regex
    ELSIF NEW.sender ILIKE '%cbe%' THEN
        -- Extract amount from "Completed ETB[amount]" or "received ETB [amount]"
        amt_text := substring(NEW.raw_message from '(?:Completed|received) ETB\s*([0-9,.]+)');
        -- Extract transaction number with pattern FT...
        txn_id := substring(NEW.raw_message from '(FT[A-Z0-9]+)');
    END IF;

    -- Clean up and parse the amount string to numeric safely
    IF amt_text IS NOT NULL THEN
        -- Remove commas before casting
        amt := CAST(replace(amt_text, ',', '') AS NUMERIC);
        NEW.extracted_amount := amt;
    END IF;
    
    -- Assign extracted transaction ID
    IF txn_id IS NOT NULL THEN
        NEW.extracted_txn_id := txn_id;
    END IF;

    -- (Optional) If you have a timestamp regex in the future, you could populate NEW.extracted_date here as well

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Database Trigger
DROP TRIGGER IF EXISTS trigger_parse_bank_sms ON bank_sms_logs;

CREATE TRIGGER trigger_parse_bank_sms
BEFORE INSERT ON bank_sms_logs
FOR EACH ROW
EXECUTE FUNCTION process_bank_sms();
