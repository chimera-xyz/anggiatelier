update public.payment_methods
set
  account_number = null,
  enabled = false,
  instructions = 'Isi nomor rekening dari menu Payment sebelum live.',
  updated_at = now()
where type = 'bank_transfer'
  and (account_number is null or btrim(account_number) = '' or account_number = '1234567890');
