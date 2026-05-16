import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

// Configuração direta do Prisma sem arquivos externos
const { PrismaPg } = await import('@prisma/adapter-pg')
import { PrismaClient } from './generated/prisma/client.ts'

// ===========================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ===========================================
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ===========================================
// CONFIGURAÇÃO DO EXPRESS
// ===========================================
const app = express()
const PORT = process.env.PORT || 3333

// Middlewares
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Middleware de log
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// ===========================================
// FUNÇÃO PARA CRIAR TABELA SE NÃO EXISTIR
// ===========================================
async function criarTabelaSeNaoExistir() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "pacientePrevenda" (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        mensagem TEXT,
        genero TEXT,
        idade TEXT,
        desafio TEXT,
        energia TEXT,
        compromisso TEXT,
        "userAgent" TEXT,
        origem TEXT,
        pagina TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Tabela verificada/criada com sucesso')
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error.message)
  }
}

// ===========================================
// ROTAS DA API
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  })
})

// GET - Listar todos os leads
app.get('/api/leads', async (req, res) => {
  try {
    const { limit = 100, page = 1, orderBy = 'desc' } = req.query
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)
    
    const [leads, total] = await Promise.all([
      prisma.pacientePrevenda.findMany({
        orderBy: { createdAt: orderBy === 'desc' ? 'desc' : 'asc' },
        skip,
        take,
      }),
      prisma.pacientePrevenda.count()
    ])
    
    res.json({
      success: true,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Erro ao listar leads:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar leads',
      message: error.message
    })
  }
})

// GET - Buscar lead por ID
app.get('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const lead = await prisma.pacientePrevenda.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead não encontrado'
      })
    }
    
    res.json({
      success: true,
      data: lead
    })
  } catch (error) {
    console.error('Erro ao buscar lead:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar lead',
      message: error.message
    })
  }
})

// POST - Criar novo lead
app.post('/api/leads', async (req, res) => {
  try {
    // Validação básica
    if (!req.body.nome || req.body.nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório e deve ter pelo menos 3 caracteres'
      })
    }
    
    if (!req.body.telefone || req.body.telefone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Telefone é obrigatório e deve ter pelo menos 10 dígitos'
      })
    }
    
    const dados = {
      nome: req.body.nome.trim(),
      telefone: req.body.telefone,
      mensagem: req.body.mensagem || null,
      genero: req.body.genero || null,
      idade: req.body.idade || null,
      desafio: req.body.desafio || null,
      energia: req.body.energia || null,
      compromisso: req.body.compromisso || null,
      userAgent: req.get('user-agent') || 'API Request',
      origem: req.body.origem || 'api_rest',
      pagina: req.body.pagina || 'api_endpoint',
    }
    
    const novoLead = await prisma.pacientePrevenda.create({
      data: dados
    })
    
    res.status(201).json({
      success: true,
      message: 'Lead criado com sucesso',
      data: novoLead
    })
  } catch (error) {
    console.error('Erro ao criar lead:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao criar lead',
      message: error.message
    })
  }
})

// PUT - Atualizar lead existente
app.put('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const leadExistente = await prisma.pacientePrevenda.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!leadExistente) {
      return res.status(404).json({
        success: false,
        error: 'Lead não encontrado'
      })
    }
    
    const dadosAtualizados = {}
    const camposPermitidos = ['nome', 'telefone', 'mensagem', 'genero', 'idade', 'desafio', 'energia', 'compromisso']
    
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        dadosAtualizados[campo] = req.body[campo]
      }
    })
    
    const leadAtualizado = await prisma.pacientePrevenda.update({
      where: { id: parseInt(id) },
      data: dadosAtualizados
    })
    
    res.json({
      success: true,
      message: 'Lead atualizado com sucesso',
      data: leadAtualizado
    })
  } catch (error) {
    console.error('Erro ao atualizar lead:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar lead',
      message: error.message
    })
  }
})

// DELETE - Remover lead
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const leadExistente = await prisma.pacientePrevenda.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!leadExistente) {
      return res.status(404).json({
        success: false,
        error: 'Lead não encontrado'
      })
    }
    
    await prisma.pacientePrevenda.delete({
      where: { id: parseInt(id) }
    })
    
    res.json({
      success: true,
      message: 'Lead removido com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar lead:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar lead',
      message: error.message
    })
  }
})

// GET - Estatísticas
app.get('/api/stats', async (req, res) => {
  try {
    const [totalLeads, ultimoLead, leadsPorOrigem] = await Promise.all([
      prisma.pacientePrevenda.count(),
      prisma.pacientePrevenda.findFirst({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.pacientePrevenda.groupBy({
        by: ['origem'],
        _count: true
      })
    ])
    
    res.json({
      success: true,
      data: {
        totalLeads,
        ultimoLead: ultimoLead ? {
          nome: ultimoLead.nome,
          createdAt: ultimoLead.createdAt
        } : null,
        leadsPorOrigem: leadsPorOrigem.map(item => ({
          origem: item.origem,
          total: item._count
        }))
      }
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar estatísticas'
    })
  }
})

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.originalUrl
  })
})

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: err.message
  })
})

// ===========================================
// INICIALIZAÇÃO DO SERVIDOR
// ===========================================
async function startServer() {
  try {
    // Criar tabela se não existir
    await criarTabelaSeNaoExistir()
    
    // Testar conexão com o banco
    await prisma.$connect()
    console.log('✅ Banco de dados conectado com sucesso')
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║   🚀 SERVIDOR API PRISMA + POSTGRESQL            ║
║   📡 Rodando em: http://localhost:${PORT}          ║
║   🏥 Health: http://localhost:${PORT}/health      ║
║   📋 Leads: http://localhost:${PORT}/api/leads    ║
╚═══════════════════════════════════════════════════╝
      `)
    })
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error)
    process.exit(1)
  }
}

// Tratamento de encerramento
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...')
  await prisma.$disconnect()
  await pool.end()
  console.log('✅ Conexões encerradas')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando servidor...')
  await prisma.$disconnect()
  await pool.end()
  console.log('✅ Conexões encerradas')
  process.exit(0)
})

// Iniciar
startServer()