/*
  Warnings:

  - You are about to drop the column `alimentacao` on the `PacientePrevenda` table. All the data in the column will be lost.
  - You are about to drop the column `compulsao` on the `PacientePrevenda` table. All the data in the column will be lost.
  - You are about to drop the column `emocional` on the `PacientePrevenda` table. All the data in the column will be lost.
  - You are about to drop the column `faseTpm` on the `PacientePrevenda` table. All the data in the column will be lost.
  - You are about to drop the column `objetivo` on the `PacientePrevenda` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PacientePrevenda" DROP COLUMN "alimentacao",
DROP COLUMN "compulsao",
DROP COLUMN "emocional",
DROP COLUMN "faseTpm",
DROP COLUMN "objetivo";

-- CreateTable
CREATE TABLE "PacienteTPM" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "mensagem" TEXT,
    "faseTpm" TEXT,
    "compulsao" TEXT,
    "alimentacao" TEXT,
    "emocional" TEXT,
    "objetivo" TEXT,
    "userAgent" TEXT,
    "origem" TEXT DEFAULT 'quiz_semana_tpm',
    "pagina" TEXT DEFAULT 'analise_tpm',
    "status" TEXT NOT NULL DEFAULT 'novo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacienteTPM_pkey" PRIMARY KEY ("id")
);
