-- PostgREST returns 406 for ops.vat_line_evidence unless ops is an exposed schema
-- and service_role can use it. The list is the current API schemas plus ops.

grant usage on schema ops to service_role;

alter role authenticator set pgrst.db_schemas =
  'public, graphql_public, kb, bank, tiger_pay, curated_kcw, raw_kcw, pay_note, transfer, catalog, ops';

notify pgrst, 'reload config';
