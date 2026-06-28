create unique index if not exists users_email_lower_unique_idx
  on users (lower(email));
