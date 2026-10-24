-- Better Auth 1.7.3 reverted the `issuer` account key added in 1.7.0-1.7.2: accounts are
-- identified by (providerId, accountId) again and new rows never write `issuer`, so the
-- NOT NULL column would reject every credential and Google account insert.
-- See https://www.better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-keeps-the-provider-key
--
-- The unique index is recreated before anything is dropped: if two rows share a
-- (providerId, accountId) pair the migration fails here and leaves the table untouched.

CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

DROP INDEX IF EXISTS "Account_issuer_accountId_key";

ALTER TABLE "Account" DROP COLUMN "issuer";
