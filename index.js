import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

// Configuração direta do Prisma sem arquivos externos
const { PrismaPg } = await import('@prisma/adapter-pg')
import { PrismaClient } from './prisma-client/client.ts'

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
// ===========================================
// ROTA ESPECÍFICA PARA O QUIZ (frontend)
// ===========================================


// Se for Express
app.head('/', (req, res) => {
  res.status(200).end();
});
app.post('/api/namorados/quiz', async (req, res) => {
  try {
    console.log('📥 [Namorados] Recebendo dados:', req.body);
    
    const {
      casalId,           
      tipoUsuario,       
      nome,
      telefone,
      email,
      anamnese,          
      relacionamento,    
      mensagem           
    } = req.body;
    
    // Validações básicas
    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    if (!tipoUsuario || !['COMPRADOR', 'PRESENTEADO'].includes(tipoUsuario)) {
      return res.status(400).json({ success: false, error: 'Tipo de usuário inválido' });
    }
    
    // --------------------------------------------------------------------
    // CASO 1: Comprador iniciando (sem casalId)
    // --------------------------------------------------------------------
    if (!casalId && tipoUsuario === 'COMPRADOR') {
      const result = await prisma.$transaction(async (tx) => {
        const novoCasal = await tx.casal.create({
          data: {
            mensagem: mensagem || null,
            status: 'PENDING'
          }
        });
        
        // Alinhado com o model 'Resposta' no singular do seu schema
       const resposta = await tx.resposta.create({
    data: {
      casalId: novoCasal.id,
      tipoUsuario: 'COMPRADOR',
      nome: nome.trim(),
      telefone: telefone || null,
      email: email || null,
      anamnese: anamnese || {},
      relacionamento: relacionamento || {}
    }
        });
        
        return { novoCasal, resposta };
      });
      
      return res.status(201).json({
        success: true,
        message: 'Presente criado! Compartilhe o link com sua pessoa especial.',
        casalId: result.novoCasal.id,
        shareLink: `https://seusite.com/presente?casalId=${result.novoCasal.id}`
      });
    }
    
    // --------------------------------------------------------------------
    // CASO 2: Presenteado respondendo (com casalId)
    // --------------------------------------------------------------------
    if (casalId && tipoUsuario === 'PRESENTEADO') {
      // Alinhado com a relação 'respostas' no plural do seu model Casal
      const casal = await prisma.casal.findUnique({
        where: { id: casalId },
        include: { respostas: true } 
      });
      
      if (!casal) {
        return res.status(404).json({ success: false, error: 'Link inválido. Presente não encontrado.' });
      }
      
      if (casal.status === 'COMPLETED') {
        return res.status(400).json({ success: false, error: 'Este presente já foi resgatado!' });
      }
      
      const compradorRespondeu = casal.respostas.some(r => r.tipoUsuario === 'COMPRADOR');
      if (!compradorRespondeu) {
        return res.status(400).json({ success: false, error: 'Aguardando o criador do presente responder primeiro.' });
      }
      
      const presenteadoJaRespondeu = casal.respostas.some(r => r.tipoUsuario === 'PRESENTEADO');
      if (presenteadoJaRespondeu) {
        return res.status(400).json({ success: false, error: 'Você já respondeu este presente!' });
      }
      
      const resposta = await prisma.resposta.create({
        data: {
          casalId: casalId,
          tipoUsuario: 'PRESENTEADO',
          nome: nome.trim(),
          telefone: telefone || null,
          email: email || null,
          anamnese: anamnese || {},
          relacionamento: relacionamento || {}
        }
      });
      
      await prisma.casal.update({
        where: { id: casalId },
        data: { status: 'COMPLETED' }
      });
      
      const todasRespostas = await prisma.resposta.findMany({
        where: { casalId: casalId }
      });
      
      const comprador = todasRespostas.find(r => r.tipoUsuario === 'COMPRADOR');
      const presenteadoResposta = todasRespostas.find(r => r.tipoUsuario === 'PRESENTEADO');
      
      // Executa em background para liberar o HTTP rapidamente
      gerarPDFsEAnalise(comprador, presenteadoResposta, casal.mensagem).catch(err => {
        console.error('❌ Erro em background ao gerar PDFs:', err);
      });
      
      return res.status(200).json({
        success: true,
        message: 'Resposta salva! Em breve você e seu parceiro receberão os resultados por email.',
        casalId: casalId
      });
    }
    
    return res.status(400).json({ success: false, error: 'Requisição inválida. Verifique os dados enviados.' });
    
  } catch (error) {
    console.error('❌ [Namorados] Erro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao processar sua resposta',
      message: error.message
    });
  }
});
app.get('/api/namorados/quiz', async (req, res) => {
  try {
    const { casalId } = req.query;

    // Validação básica se o ID foi enviado
    if (!casalId) {
      return res.status(400).json({ 
        success: false, 
        error: 'O parâmetro casalId é obrigatório na URL.' 
      });
    }

    // Busca o casal e traz junto todas as respostas atreladas a ele
    const casal = await prisma.casal.findUnique({
      where: { id: casalId },
      include: { respostas: true }
    });

    // Se não encontrar o registro do casal
    if (!casal) {
      return res.status(404).json({ 
        success: false, 
        error: 'Link inválido. Quiz ou casal não encontrado.' 
      });
    }

    // Separa as respostas para facilitar o uso no Frontend
    const comprador = casal.respostas.find(r => r.tipoUsuario === 'COMPRADOR');
    const presenteado = casal.respostas.find(r => r.tipoUsuario === 'PRESENTEADO');

    // Retorno de sucesso com a estrutura organizada
    return res.status(200).json({
      success: true,
      data: {
        id: casal.id,
        status: casal.status,
        mensagem: casal.mensagem,
        criadoEm: casal.createdAt, // Ou o nome do campo de data que tiver no seu schema
        comprador: comprador ? {
          nome: comprador.nome,
          // Evite expor dados sensíveis se for apenas a tela de convite, 
          // mas se precisar para o painel final, pode descomentar abaixo:
          // email: comprador.email,
          // telefone: comprador.telefone,
          // anamnese: comprador.anamnese,
          // relacionamento: comprador.relacionamento
        } : null,
        presenteadoJaRespondeu: !!presenteado,
        // Se o quiz já foi finalizado, você pode liberar os dados completos se necessário
        respostasCompletas: casal.status === 'COMPLETED' ? casal.respostas : null
      }
    });

  } catch (error) {
    console.error('❌ [Namorados GET] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar os dados do quiz.',
      message: error.message
    });
  }
});

// ===========================================
// ROTA PARA SALVAR LEAD DA TPM (POST)
// ===========================================
app.post('/api/tpm/leads', async (req, res) => {
  try {
    console.log('📥 [TPM] Recebendo dados:', req.body);
    
    const {
      nome,
      telefone,
      email,
      mensagem,
      fase_tpm,
      compulsao,
      alimentacao,
      emocional,
      objetivo,
      sessionId,
      userAgent,
      origem,
      pagina
    } = req.body;
    
    // Validação
    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório e deve ter pelo menos 3 caracteres'
      });
    }
    
    if (!telefone || telefone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Telefone é obrigatório e deve ter pelo menos 10 dígitos'
      });
    }
    
    // Verificar se já existe lead com este sessionId
    let lead = null;
    if (sessionId) {
      lead = await prisma.pacienteTPM.findFirst({
        where: { sessionId: sessionId }
      });
    }
    
    const now = new Date();
    
    if (lead) {
      // Atualizar lead existente
      lead = await prisma.pacienteTPM.update({
        where: { id: lead.id },
        data: {
          nome: nome.trim(),
          telefone: telefone,
          email: email || null,
          mensagem: mensagem || null,
          faseTpm: fase_tpm || null,
          compulsao: compulsao || null,
          alimentacao: alimentacao || null,
          emocional: emocional || null,
          objetivo: objetivo || null,
          quizCompletedAt: now,
          status: 'lead_qualificado',
          updatedAt: now
        }
      });
      console.log('✅ [TPM] Lead atualizado ID:', lead.id);
    } else {
      // Criar novo lead
      lead = await prisma.pacienteTPM.create({
        data: {
          nome: nome.trim(),
          telefone: telefone,
          email: email || null,
          mensagem: mensagem || null,
          faseTpm: fase_tpm || null,
          compulsao: compulsao || null,
          alimentacao: alimentacao || null,
          emocional: emocional || null,
          objetivo: objetivo || null,
          sessionId: sessionId || null,
          userAgent: userAgent || req.get('user-agent') || 'TPM Quiz',
          origem: origem || 'quiz_semana_tpm',
          pagina: pagina || 'analise_tpm',
          quizStartedAt: now,
          quizCompletedAt: now,
          status: 'novo'
        }
      });
      console.log('✅ [TPM] Lead criado ID:', lead.id);
    }
    
    res.status(201).json({
      success: true,
      message: 'Análise da TPM salva com sucesso!',
      data: {
        id: lead.id,
        nome: lead.nome,
        createdAt: lead.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ [TPM] Erro ao salvar lead:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao salvar análise da TPM',
      message: error.message
    });
  }
});

// ===========================================
// ROTA PARA REGISTRAR INÍCIO DO QUIZ
// ===========================================
app.post('/api/tpm/quiz-start', async (req, res) => {
  try {
    const { sessionId, userAgent } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId é obrigatório' 
      });
    }
    
    // Buscar se já existe lead com este sessionId
    let lead = await prisma.pacienteTPM.findFirst({
      where: { sessionId: sessionId }
    });
    
    const now = new Date();
    
    if (!lead) {
      // Criar registro apenas com o início (placeholder)
      lead = await prisma.pacienteTPM.create({
        data: {
          sessionId: sessionId,
          userAgent: userAgent?.substring(0, 255) || req.get('user-agent'),
          origem: 'quiz_semana_tpm',
          pagina: 'analise_tpm',
          quizStartedAt: now,
          status: 'em_andamento',
          nome: 'visitante_anonimo',
          telefone: '00000000000'
        }
      });
      console.log(`📊 [TPM] Quiz iniciado - nova sessão: ${sessionId}`);
    } else if (!lead.quizStartedAt) {
      // Atualizar apenas o campo de início
      lead = await prisma.pacienteTPM.update({
        where: { id: lead.id },
        data: { quizStartedAt: now }
      });
      console.log(`📊 [TPM] Quiz iniciado - sessão existente: ${sessionId}`);
    } else {
      console.log(`📊 [TPM] Quiz já iniciado anteriormente: ${sessionId}`);
    }
    
    res.json({ success: true, message: 'Quiz start registrado' });
    
  } catch (error) {
    console.error('❌ [TPM] Erro ao registrar início:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===========================================
// ROTA PARA MÉTRICAS
// ===========================================
app.get('/api/tpm/metrics', async (req, res) => {
  try {
    const { periodo = '30' } = req.query;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(periodo));
    
    // Contagem total
    const [totalAcessos, totalInicios, totalCompletos, totalLeads] = await Promise.all([
      prisma.pacienteTPM.count({
        where: { createdAt: { gte: dataLimite } }
      }),
      prisma.pacienteTPM.count({
        where: { 
          quizStartedAt: { not: null },
          createdAt: { gte: dataLimite }
        }
      }),
      prisma.pacienteTPM.count({
        where: { 
          quizCompletedAt: { not: null },
          createdAt: { gte: dataLimite }
        }
      }),
      prisma.pacienteTPM.count({
        where: { 
          status: 'lead_qualificado',
          createdAt: { gte: dataLimite }
        }
      })
    ]);
    
    // Leads únicos (com nome real)
    const leadsUnicos = await prisma.pacienteTPM.count({
      where: {
        nome: { not: 'visitante_anonimo' },
        telefone: { not: '00000000000' },
        createdAt: { gte: dataLimite }
      }
    });
    
    // Taxas de conversão
    const taxaInicio = totalAcessos > 0 ? ((totalInicios / totalAcessos) * 100).toFixed(1) : 0;
    const taxaConclusao = totalInicios > 0 ? ((totalCompletos / totalInicios) * 100).toFixed(1) : 0;
    const taxaLead = totalCompletos > 0 ? ((leadsUnicos / totalCompletos) * 100).toFixed(1) : 0;
    
    res.json({
      success: true,
      metrics: {
        periodo: `${periodo} dias`,
        total: {
          acessos: totalAcessos,
          inicios: totalInicios,
          completos: totalCompletos,
          leads: leadsUnicos
        },
        taxas: {
          inicio: `${taxaInicio}%`,
          conclusao: `${taxaConclusao}%`,
          conversaoLead: `${taxaLead}%`
        },
        funnel: {
          acessaram: totalAcessos,
          comecaram: totalInicios,
          finalizaram: totalCompletos,
          deixaramContato: leadsUnicos
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [TPM] Erro ao buscar métricas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===========================================
// ROTA PARA FUNIL DE CONVERSÃO
app.get('/api/tpm/funnel', async (req, res) => {
  try {
    // CORRIGIDO: Usar "PacienteTPM" com aspas duplas
    const resultados = await prisma.$queryRaw`
      SELECT 
        'Página visualizada' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      
      UNION ALL
      
      SELECT 
        'Iniciaram o quiz' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE "quizStartedAt" IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Responderam fase TPM' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE "faseTpm" IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Responderam compulsão' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE compulsao IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Responderam alimentação' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE alimentacao IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Responderam emocional' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE emocional IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Responderam objetivo' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE objetivo IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Deixaram contato' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE nome != 'visitante_anonimo' AND telefone != '00000000000'
      
      UNION ALL
      
      SELECT 
        'Finalizaram com sucesso' as etapa,
        COUNT(*)::int as total
      FROM "PacienteTPM"
      WHERE "quizCompletedAt" IS NOT NULL
    `;
    
    res.json({ success: true, funnel: resultados });
    
  } catch (error) {
    console.error('❌ [TPM] Erro ao buscar funil:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
// ===========================================
// ROTA PARA LISTAR LEADS (Dashboard)
// ===========================================
app.get('/api/tpm/leads', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { status, origem, busca } = req.query;
    const onde = {};
    
    if (status) onde.status = status;
    if (origem) onde.origem = origem;
    
    if (busca) {
      onde.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { telefone: { contains: busca } },
        { email: { contains: busca, mode: 'insensitive' } }
      ];
    }
    
    const [leads, totalLeads] = await prisma.$transaction([
      prisma.pacienteTPM.findMany({
        where: onde,
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.pacienteTPM.count({ where: onde })
    ]);
    
    res.json({
      success: true,
      data: leads,
      pagination: {
        totalItems: totalLeads,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalLeads / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ [TPM] Erro ao listar leads:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
app.post('/salvarpacienteprevenda', async (req, res) => {
  try {
    console.log('📥 Recebendo dados do quiz:', req.body);
    
    const {
      nome,
      telefone,
      email,
      mensagem,
      genero,
      idade,
      desafio,
      energia,
      compromisso,
      userAgent,
      origem,
      pagina
    } = req.body;
    
    // Validação básica
    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório e deve ter pelo menos 3 caracteres'
      });
    }
    
    if (!telefone || telefone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Telefone é obrigatório'
      });
    }
    
    // Salvar no banco de dados usando Prisma
    const novoLead = await prisma.pacientePrevenda.create({
      data: {
        nome: nome.trim(),
        telefone: telefone,
        mensagem: mensagem || null,
        genero: genero || null,
        idade: idade || null,
        desafio: desafio || null,
        energia: energia || null,
        compromisso: compromisso || null,
        userAgent: userAgent || req.get('user-agent') || 'Quiz Frontend',
        origem: origem || 'quiz_mapeamento',
        pagina: pagina || 'formulario_contato',
      }
    });
    
    console.log('✅ Lead salvo com sucesso:', novoLead.id);
    
    res.status(201).json({
      success: true,
      message: 'Lead salvo com sucesso',
      data: novoLead
    });
    
  } catch (error) {
    console.error('❌ Erro ao salvar lead do quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao salvar dados',
      message: error.message
    });
  }
});
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