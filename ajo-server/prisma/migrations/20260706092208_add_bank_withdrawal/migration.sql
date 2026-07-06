/*
  Warnings:

  - A unique constraint covering the columns `[userId,accountNumber,bankCode]` on the table `beneficiaries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "transactionPinHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_userId_accountNumber_bankCode_key" ON "beneficiaries"("userId", "accountNumber", "bankCode");
