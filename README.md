# Coach Copilot V3.0 cloud preview

Adds real Supabase authentication and role detection to the existing PWA.

## Important
Programme/workout records are still using the existing localStorage engine in this transition build. Do not use this build as proof of cross-device sync yet. The next migration moves programme/workout reads and writes to the Supabase tables already created.

The Supabase publishable key in `index.html` is intentionally client-side. Never add a secret/service-role key to this repository.
