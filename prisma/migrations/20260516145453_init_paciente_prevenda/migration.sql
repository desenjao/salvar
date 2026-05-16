-- CreateTable
CREATE TABLE "PacientePrevenda" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "mensagem" TEXT,
    "genero" TEXT NOT NULL,
    "idade" TEXT NOT NULL,
    "desafio" TEXT NOT NULL,
    "energia" TEXT NOT NULL,
    "compromisso" TEXT NOT NULL,
    "userAgent" TEXT,
    "origem" TEXT,
    "pagina" TEXT NOT NULL DEFAULT 'quiz',
    "status" TEXT NOT NULL DEFAULT 'prevenda',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacientePrevenda_pkey" PRIMARY KEY ("id")
);
