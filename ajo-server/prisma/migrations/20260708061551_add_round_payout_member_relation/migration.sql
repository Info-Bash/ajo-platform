-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_payoutMemberId_fkey" FOREIGN KEY ("payoutMemberId") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
