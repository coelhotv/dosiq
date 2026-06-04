-- Migration: Create user_emails view for secure backend access to user emails
-- Created: 2026-06-04

CREATE OR REPLACE VIEW public.user_emails AS
SELECT id, email FROM auth.users;

-- Revogar acessos públicos e conceder somente para service_role
REVOKE ALL ON public.user_emails FROM anon;
REVOKE ALL ON public.user_emails FROM authenticated;
GRANT SELECT ON public.user_emails TO service_role;
