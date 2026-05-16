import chalk from 'chalk'
import fs from 'fs/promises'
import path from 'path'

// Configurações
const API_URL = 'http://localhost:3333'
const LOG_FILE = './logs/teste-log.json'

// Cores para logs (usando chalk)
const log = {
  info: (msg) => console.log(chalk.blue('ℹ️ ') + chalk.blue(msg)),
  success: (msg) => console.log(chalk.green('✅ ') + chalk.green(msg)),
  error: (msg) => console.log(chalk.red('❌ ') + chalk.red(msg)),
  warn: (msg) => console.log(chalk.yellow('⚠️ ') + chalk.yellow(msg)),
  debug: (msg) => console.log(chalk.gray('🔍 ') + chalk.gray(msg)),
  api: (msg) => console.log(chalk.magenta('📡 ') + chalk.magenta(msg)),
  data: (data) => console.log(chalk.cyan(JSON.stringify(data, null, 2)))
}

// Armazenar resultados dos testes
const resultados = {
  inicio: new Date().toISOString(),
  tests: [],
  resumo: {
    total: 0,
    passou: 0,
    falhou: 0,
    erros: []
  }
}

// Função para salvar log
async function salvarLog() {
  try {
    const dir = './logs'
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(LOG_FILE, JSON.stringify(resultados, null, 2))
    log.success(`Log salvo em: ${LOG_FILE}`)
  } catch (error) {
    log.error(`Erro ao salvar log: ${error.message}`)
  }
}

// Função para testar com tratamento de erro inteligente
async function testarEndpoint(nome, metodo, endpoint, dados = null, expectedStatus = 200) {
  const testResult = {
    nome,
    metodo,
    endpoint,
    timestamp: new Date().toISOString(),
    status: 'pending',
    error: null,
    resposta: null,
    duracao: null
  }
  
  const inicio = Date.now()
  
  try {
    log.api(`\n📡 Testando: ${nome}`)
    log.debug(`${metodo} ${endpoint}`)
    
    const options = {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Suite/1.0'
      }
    }
    
    if (dados && (metodo === 'POST' || metodo === 'PUT')) {
      options.body = JSON.stringify(dados)
      log.debug(`Dados: ${JSON.stringify(dados)}`)
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options)
    const duracao = Date.now() - inicio
    testResult.duracao = `${duracao}ms`
    
    let responseData = null
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json()
      testResult.resposta = responseData
    } else {
      responseData = await response.text()
      testResult.resposta = { texto: responseData }
    }
    
    // Verificar status esperado
    if (response.status === expectedStatus) {
      testResult.status = 'passed'
      resultados.resumo.passou++
      log.success(`✓ Sucesso! Status: ${response.status} (${duracao}ms)`)
      
      // Log detalhado da resposta (apenas para sucesso)
      if (responseData && typeof responseData === 'object') {
        if (responseData.data) {
          log.data({ data: responseData.data })
        } else {
          log.data(responseData)
        }
      }
    } else {
      testResult.status = 'failed'
      testResult.error = `Status esperado ${expectedStatus}, recebido ${response.status}`
      resultados.resumo.falhou++
      resultados.resumo.erros.push({
        test: nome,
        expected: expectedStatus,
        received: response.status,
        response: responseData
      })
      log.error(`✗ Falhou! Status: ${response.status} (esperado ${expectedStatus})`)
      if (responseData && responseData.error) {
        log.error(`Erro: ${responseData.error}`)
      }
    }
    
  } catch (error) {
    const duracao = Date.now() - inicio
    testResult.duracao = `${duracao}ms`
    testResult.status = 'failed'
    testResult.error = error.message
    resultados.resumo.falhou++
    resultados.resumo.erros.push({
      test: nome,
      error: error.message,
      stack: error.stack
    })
    
    log.error(`✗ Erro crítico! ${error.message}`)
    
    if (error.code === 'ECONNREFUSED') {
      log.error(`Servidor não está rodando em ${API_URL}`)
      log.error(`Certifique-se de executar 'node index.js' primeiro`)
    } else if (error.code === 'ENOTFOUND') {
      log.error(`URL inválida ou sem conexão com a internet`)
    } else {
      log.debug(error.stack)
    }
  }
  
  resultados.tests.push(testResult)
  resultados.resumo.total++
  return testResult
}

// Função principal de testes
async function executarTestes() {
  console.clear()
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'))
  console.log(chalk.bold.cyan('║     🧪 TESTE INTELIGENTE DA API PRISMA + POSTGRES       ║'))
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝\n'))
  
  log.info(`API URL: ${API_URL}`)
  log.info(`Iniciando suite de testes em: ${new Date().toLocaleString()}\n`)
  
  // Verificar se o servidor está online
  log.info('Verificando conectividade com o servidor...')
  try {
    const healthCheck = await fetch(`${API_URL}/health`)
    if (healthCheck.ok) {
      log.success('Servidor está online!')
      const healthData = await healthCheck.json()
      log.debug(`Uptime: ${healthData.uptime?.toFixed(2)}s`)
    } else {
      log.error('Servidor respondeu com erro!')
    }
  } catch (error) {
    log.error(`Servidor offline: ${error.message}`)
    log.error('\n💡 Solução: Execute "node index.js" em outro terminal primeiro!\n')
    await salvarLog()
    process.exit(1)
  }
  
  // 1. TESTE DE HEALTH CHECK
  await testarEndpoint(
    'Health Check',
    'GET',
    '/health',
    null,
    200
  )
  
  // 2. LISTAR LEADS (inicialmente vazio)
  await testarEndpoint(
    'Listar Leads (inicial)',
    'GET',
    '/api/leads',
    null,
    200
  )
  
  // 3. CRIAR LEAD VÁLIDO
  const leadValido = {
    nome: "Maria Teste Silva",
    telefone: "5585999888777",
    mensagem: "Teste automatizado com validação",
    genero: "Feminino",
    idade: "35 a 44 anos",
    desafio: "Estresse e ansiedade",
    energia: "Média",
    compromisso: "Alto",
    origem: "teste_automatizado",
    pagina: "teste_integracao"
  }
  
  const criarLead = await testarEndpoint(
    'Criar Lead Válido',
    'POST',
    '/api/leads',
    leadValido,
    201
  )
  
  let leadId = null
  if (criarLead.resposta && criarLead.resposta.data && criarLead.resposta.data.id) {
    leadId = criarLead.resposta.data.id
    log.success(`Lead criado com ID: ${leadId}`)
  }
  
  // 4. CRIAR LEAD INVÁLIDO (sem nome)
  await testarEndpoint(
    'Criar Lead Inválido (sem nome)',
    'POST',
    '/api/leads',
    { telefone: "5585999999999" },
    400
  )
  
  // 5. CRIAR LEAD INVÁLIDO (sem telefone)
  await testarEndpoint(
    'Criar Lead Inválido (sem telefone)',
    'POST',
    '/api/leads',
    { nome: "Teste Incompleto" },
    400
  )
  
  // 6. BUSCAR LEAD POR ID (se existir)
  if (leadId) {
    await testarEndpoint(
      'Buscar Lead por ID',
      'GET',
      `/api/leads/${leadId}`,
      null,
      200
    )
    
    // 7. BUSCAR ID INEXISTENTE
    await testarEndpoint(
      'Buscar ID Inexistente',
      'GET',
      '/api/leads/99999',
      null,
      404
    )
    
    // 8. ATUALIZAR LEAD
    const atualizacao = {
      nome: "Maria Teste Atualizada",
      mensagem: "Dados atualizados pelo teste automatizado",
      energia: "Alta total"
    }
    
    await testarEndpoint(
      'Atualizar Lead',
      'PUT',
      `/api/leads/${leadId}`,
      atualizacao,
      200
    )
    
    // 9. VERIFICAR ATUALIZAÇÃO
    await testarEndpoint(
      'Verificar Atualização',
      'GET',
      `/api/leads/${leadId}`,
      null,
      200
    )
  }
  
  // 10. LISTAR LEADS COM PAGINAÇÃO
  await testarEndpoint(
    'Listar Leads (página 1)',
    'GET',
    '/api/leads?page=1&limit=5',
    null,
    200
  )
  
  // 11. ESTATÍSTICAS
  await testarEndpoint(
    'Estatísticas da API',
    'GET',
    '/api/stats',
    null,
    200
  )
  
  // 12. ROTA INEXISTENTE (404)
  await testarEndpoint(
    'Rota Inexistente (404)',
    'GET',
    '/api/rota_que_nao_existe',
    null,
    404
  )
  
  // 13. TESTE DE CARGA RÁPIDA (opcional)
  log.info('\n📊 Teste rápido de carga (3 requisições simultâneas)...')
  const cargaStart = Date.now()
  const promises = []
  for (let i = 0; i < 3; i++) {
    promises.push(
      fetch(`${API_URL}/api/leads?limit=1`)
        .then(res => res.json())
        .then(() => log.debug(`Requisição ${i + 1} concluída`))
        .catch(err => log.error(`Requisição ${i + 1} falhou: ${err.message}`))
    )
  }
  await Promise.all(promises)
  const cargaDuracao = Date.now() - cargaStart
  log.success(`Teste de carga concluído em ${cargaDuracao}ms`)
  
  // 14. DELETAR LEAD (limpeza)
  if (leadId) {
    await testarEndpoint(
      'Deletar Lead (limpeza)',
      'DELETE',
      `/api/leads/${leadId}`,
      null,
      200
    )
    
    // Verificar se foi deletado
    await testarEndpoint(
      'Verificar Deleção',
      'GET',
      `/api/leads/${leadId}`,
      null,
      404
    )
  }
  
  // ===========================================
  // RESUMO FINAL
  // ===========================================
  console.log(chalk.bold('\n╔═══════════════════════════════════════════════════════════╗'))
  console.log(chalk.bold('║                    📊 RESUMO DOS TESTES                  ║'))
  console.log(chalk.bold('╚═══════════════════════════════════════════════════════════╝\n'))
  
  resultados.fim = new Date().toISOString()
  const duracaoTotal = new Date(resultados.fim) - new Date(resultados.inicio)
  
  console.log(chalk.white(`⏱️  Duração total: ${(duracaoTotal / 1000).toFixed(2)}s`))
  console.log(chalk.white(`📝 Total de testes: ${resultados.resumo.total}`))
  console.log(chalk.green(`✅ Passaram: ${resultados.resumo.passou}`))
  console.log(chalk.red(`❌ Falharam: ${resultados.resumo.falhou}`))
  
  const percentual = (resultados.resumo.passou / resultados.resumo.total * 100).toFixed(1)
  
  if (resultados.resumo.falhou === 0) {
    console.log(chalk.green.bold(`\n🎉 SUCESSO! 100% dos testes passaram! (${percentual}%)\n`))
  } else {
    console.log(chalk.yellow(`\n⚠️  Taxa de sucesso: ${percentual}%\n`))
    
    if (resultados.resumo.erros.length > 0) {
      console.log(chalk.red('🔴 ERROS DETECTADOS:'))
      resultados.resumo.erros.forEach((erro, index) => {
        console.log(chalk.red(`\n  ${index + 1}. ${erro.test}`))
        console.log(chalk.red(`     ${erro.error || JSON.stringify(erro.response)}`))
      })
    }
  }
  
  // Dicas de solução
  if (resultados.resumo.falhou > 0) {
    console.log(chalk.cyan('\n💡 DICAS DE SOLUÇÃO:'))
    console.log(chalk.white('  • Verifique se o servidor está rodando (node index.js)'))
    console.log(chalk.white('  • Confirme se o banco de dados está conectado'))
    console.log(chalk.white('  • Verifique as variáveis de ambiente no .env'))
    console.log(chalk.white('  • Execute "npx prisma generate" para regenerar o cliente'))
    console.log(chalk.white('  • Veja os logs completos em: ' + LOG_FILE))
  }
  
  // Salvar log
  await salvarLog()
  
  console.log(chalk.gray('\n✨ Teste finalizado! ✨\n'))
  
  // Exit code baseado no sucesso
  process.exit(resultados.resumo.falhou === 0 ? 0 : 1)
}

// Tratamento de erros globais
process.on('unhandledRejection', (error) => {
  log.error(`Erro não tratado: ${error.message}`)
  salvarLog()
  process.exit(1)
})

// Executar testes
executarTestes().catch(async (error) => {
  log.error(`Erro fatal na execução dos testes: ${error.message}`)
  await salvarLog()
  process.exit(1)
})