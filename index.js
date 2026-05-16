import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
// Altere a linha 4 para isso:
import { PrismaClient } from './generated/prisma/client.ts' // Caminho gerado pelo novo output

// 1. Configura o pool de conexão nativo do Driver do PostgreSQL (pg)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

// 2. Instancia o cliente passando o adaptador oficial
const prisma = new PrismaClient({ adapter })

async function main() {
  console.clear()
  console.log('🚀 Iniciando testes com a nova arquitetura do Prisma...\n')

  // Criando o registro de teste
  console.log('📌 Inserindo lead de pré-venda...')
  const novoPaciente = await prisma.pacientePrevenda.create({
    data: {
      nome: 'Kelvin Desenrolado v7',
      telefone: '5589999999999',
      mensagem: 'Testando a nova reescrita em TypeScript do Prisma!',
      genero: 'Masculino',
      idade: '25 a 34 anos',
      desafio: 'Se adaptar às atualizações de software',
      energia: 'Alta total',
      compromisso: 'Inabalável',
      userAgent: 'Node.js Engine',
      origem: 'documentacao_quickstart',
      pagina: 'quiz_v7',
    },
  })

  console.log('✅ Sucesso! Registro criado com ID:', novoPaciente.id)
  
  // Buscando os dados para validar
  console.log('\n📌 Buscando registros no banco...')
  const todos = await prisma.pacientePrevenda.findMany({
    orderBy: { createdAt: 'desc' }
  })
  
  console.table(todos)
}

main()
  .catch((error) => {
    console.error('❌ Erro durante o teste:', error)
    process.exit(1)
  })
  .finally(async () => {
    // Fecha a conexão do cliente e do pool de processos do driver
    await prisma.$disconnect()
    await pool.end()
    console.log('\n🔒 Conexões encerradas com segurança.')
  })