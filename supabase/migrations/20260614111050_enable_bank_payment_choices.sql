update public.payment_methods
set enabled = true, updated_at = now()
where bank_code in ('bca', 'blu-bca', 'seabank');
