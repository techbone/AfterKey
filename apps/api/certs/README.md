# Supabase database trust certificate

`supabase-prod-ca-2021.crt` is the public Supabase Root 2021 CA certificate. It contains no credentials. It was downloaded on October 11, 2026 from the [production download URL](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt) published in Supabase's official [dashboard configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json) and [SSL settings component](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Settings/Database/SSLConfiguration.tsx).

SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Expiry: April 26, 2031. Obtain any replacement from the official dashboard/vendor source and review the updated fingerprint. Configure PostgreSQL URIs with `sslmode=verify-full` and `sslrootcert` set to this file's runtime path; keep the password and complete URI in private environment configuration. Supabase documents this approach in its [SSL guide](https://supabase.com/docs/guides/platform/ssl-enforcement).
