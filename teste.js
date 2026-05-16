import chalk from 'chalk'
import fs from 'fs/promises'
import path from 'path'

// Configurações - API em PRODUÇÃO
const API_URL = 'https://thaicnutriback.onrender.com'
const LOG_FILE = './logs/teste-producao-log.json'

// Cores para logs
const log = {
  info: (msg) => console.log(chalk.blue('ℹ️ ') + chalk.blue(msg)),
  success: (msg) => console.log(chalk.green('✅ ') + chalk.green(msg)),
  error: (msg) => console.log(chalk.red('❌ ') + chalk.red(msg)),
  warn: (msg) => console.log(chalk.yellow('⚠️ ') + chalk.yellow(msg)),
  debug: (msg) => console.log(chalk.gray('🔍 ') + chalk.gray(msg)),
  api: (msg) => console.log(chalk.magenta('📡 ') + chalk.magenta(msg)),
  data: (data) => console.log(chalk.cyan(JSON.stringify(data, null, 2)))
}

// Armazenar resultados
const resultados = {
  inicio: new Date().toISOString(),
  api_url: API_URL,
  tests: [],
  resumo: {
    total: 0,
    passou: 0,
    falhou: 0,
    erros: []
  }
}

// Salvar log
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

// Função de teste com timeout
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
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout
    
    const options = {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Production-Test-Suite/1.0'
      },
      signal: controller.signal
    }
    
    if (dados && (metodo === 'POST' || metodo === 'PUT')) {
      options.body = JSON.stringify(dados)
      log.debug(`Dados: ${JSON.stringify(dados)}`)
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options)
    clearTimeout(timeoutId)
    
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
    
    if (response.status === expectedStatus) {
      testResult.status = 'passed'
      resultados.resumo.passou++
      log.success(`✓ Sucesso! Status: ${response.status} (${duracao}ms)`)
      
      if (responseData && typeof responseData === 'object') {
        if (responseData.data) {
          log.data({ data: responseData.data })
        } else if (nome === 'Health Check') {
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
    
    if (error.name === 'AbortError') {
      testResult.error = 'Timeout após 10 segundos'
      log.error(`✗ Timeout! O servidor demorou muito para responder`)
    } else if (error.code === 'ENOTFOUND') {
      testResult.error = `URL não encontrada: ${API_URL}`
      log.error(`✗ Servidor não encontrado! Verifique se a URL está correta`)
    } else {
      testResult.error = error.message
      log.error(`✗ Erro: ${error.message}`)
    }
    
    resultados.resumo.falhou++
    resultados.resumo.erros.push({
      test: nome,
      error: error.message,
      stack: error.stack
    })
  }
  
  resultados.tests.push(testResult)
  resultados.resumo.total++
  return testResult
}

// Função principal
async function executarTestes() {
  console.clear()
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'))
  console.log(chalk.bold.cyan('║     🧪 TESTE DE PRODUÇÃO - API PRISMA + POSTGRES        ║'))
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝\n'))
  
  log.info(`🌐 API URL: ${API_URL}`)
  log.info(`📅 Início: ${new Date().toLocaleString()}\n`)
  
  // Verificar conectividade
  log.info('Verificando conectividade com o servidor de produção...')
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const healthCheck = await fetch(`${API_URL}/health`, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (healthCheck.ok) {
      log.success('✅ Servidor de produção está ONLINE!')
      const healthData = await healthCheck.json()
      log.debug(`Status: ${healthData.status}`)
      log.debug(`Database: ${healthData.database}`)
      log.debug(`Uptime: ${healthData.uptime?.toFixed(2)}s`)
    } else {
      log.error('Servidor respondeu com erro!')
    }
  } catch (error) {
    log.error(`❌ Servidor OFFLINE ou inacessível: ${error.message}`)
    log.error('\n💡 Possíveis causas:')
    log.error('   • O servidor pode estar desligado no Render')
    log.error('   • URL pode estar incorreta')
    log.error('   • Pode ter excedido o limite de requisições gratuitas')
    log.error('   • O plano gratuito do Render pode ter entrado em hibernação')
    log.error('\n💡 Soluções:')
    log.error('   • Acesse https://dashboard.render.com e verifique o status')
    log.error('   • O servidor pode levar 30-60 segundos para acordar do hibernação')
    log.error('   • Execute o teste novamente após 1 minuto\n')
    await salvarLog()
    process.exit(1)
  }
  
  // Testes básicos (CRUD)
  await testarEndpoint('Health Check', 'GET', '/health', null, 200)
  await testarEndpoint('Listar Leads', 'GET', '/api/leads', null, 200)
  
  // Criar lead de teste
  const leadTeste = {
    nome: "Teste Produção Render",
    telefone: "5585999999999",
    mensagem: "Testando API em produção no Render",
    genero: "Masculino",
    idade: "25 a 34 anos",
    desafio: "Teste de deploy",
    energia: "Alta",
    compromisso: "Total",
    origem: "teste_producao",
    pagina: "render_test"
  }
  
  const criarLead = await testarEndpoint(
    'Criar Lead (Produção)',
    'POST',
    '/api/leads',
    leadTeste,
    201
  )
  
  let leadId = null
  if (criarLead.resposta?.data?.id) {
    leadId = criarLead.resposta.data.id
    log.success(`Lead criado com ID: ${leadId}`)
  }
  
  // Testes condicionais (se o lead foi criado)
  if (leadId) {
    await testarEndpoint('Buscar Lead por ID', 'GET', `/api/leads/${leadId}`, null, 200)
    await testarEndpoint('Atualizar Lead', 'PUT', `/api/leads/${leadId}`, {
      nome: "Teste Produção Atualizado",
      mensagem: "Dados atualizados via teste de produção"
    }, 200)
    await testarEndpoint('Verificar Atualização', 'GET', `/api/leads/${leadId}`, null, 200)
  }
  
  // Testes de validação
  await testarEndpoint('Lead Inválido (sem nome)', 'POST', '/api/leads', { telefone: "123" }, 400)
  await testarEndpoint('Lead Inválido (sem telefone)', 'POST', '/api/leads', { nome: "Teste" }, 400)
  await testarEndpoint('Buscar ID Inexistente', 'GET', '/api/leads/99999', null, 404)
  
  // Testes de listagem
  await testarEndpoint('Listar Leads (paginado)', 'GET', '/api/leads?page=1&limit=5', null, 200)
  
  // Estatísticas
  await testarEndpoint('Estatísticas da API', 'GET', '/api/stats', null, 200)
  
  // Rota 404
  await testarEndpoint('Rota Inexistente', 'GET', '/api/rota_que_nao_existe', null, 404)
  
  // Limpeza (deletar lead criado)
  if (leadId) {
    await testarEndpoint('Deletar Lead (limpeza)', 'DELETE', `/api/leads/${leadId}`, null, 200)
    await testarEndpoint('Verificar Deleção', 'GET', `/api/leads/${leadId}`, null, 404)
  }
  
  // Teste de carga leve
  log.info('\n📊 Teste rápido de carga (5 requisições)...')
  const cargaStart = Date.now()
  const promises = []
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch(`${API_URL}/api/leads?limit=1`)
        .then(res => res.json())
        .then(() => log.debug(`Requisição ${i + 1} concluída`))
        .catch(err => log.error(`Requisição ${i + 1} falhou: ${err.message}`))
    )
  }
  await Promise.all(promises)
  const cargaDuracao = Date.now() - cargaStart
  log.success(`Teste de carga concluído em ${cargaDuracao}ms (média: ${(cargaDuracao/5).toFixed(0)}ms/req)`)
  
  // RESUMO FINAL
  console.log(chalk.bold('\n╔═══════════════════════════════════════════════════════════╗'))
  console.log(chalk.bold('║              📊 RESUMO DOS TESTES (PRODUÇÃO)             ║'))
  console.log(chalk.bold('╚═══════════════════════════════════════════════════════════╝\n'))
  
  resultados.fim = new Date().toISOString()
  const duracaoTotal = new Date(resultados.fim) - new Date(resultados.inicio)
  
  console.log(chalk.white(`🌐 API: ${API_URL}`))
  console.log(chalk.white(`⏱️  Duração total: ${(duracaoTotal / 1000).toFixed(2)}s`))
  console.log(chalk.white(`📝 Testes executados: ${resultados.resumo.total}`))
  console.log(chalk.green(`✅ Passaram: ${resultados.resumo.passou}`))
  console.log(chalk.red(`❌ Falharam: ${resultados.resumo.falhou}`))
  
  const percentual = (resultados.resumo.passou / resultados.resumo.total * 100).toFixed(1)
  
  if (resultados.resumo.falhou === 0) {
    console.log(chalk.green.bold(`\n🎉 SUCESSO! API em produção está 100% funcional! (${percentual}%)\n`))
  } else {
    console.log(chalk.yellow(`\n⚠️  Taxa de sucesso: ${percentual}%\n`))
    
    if (resultados.resumo.erros.length > 0) {
      console.log(chalk.red('🔴 ERROS DETECTADOS:'))
      resultados.resumo.erros.forEach((erro, index) => {
        console.log(chalk.red(`  ${index + 1}. ${erro.test}`))
        console.log(chalk.red(`     ${erro.error || JSON.stringify(erro.response)}`))
      })
    }
  }
  
  // Dicas de performance
  console.log(chalk.cyan('\n📊 MÉTRICAS DE PERFORMANCE:'))
  const tempos = resultados.tests.filter(t => t.duracao).map(t => parseInt(t.duracao))
  const media = tempos.reduce((a,b) => a + b, 0) / tempos.length
  const max = Math.max(...tempos)
  const min = Math.min(...tempos)
  
  console.log(chalk.white(`  ⚡ Tempo médio: ${media.toFixed(0)}ms`))
  console.log(chalk.white(`  🚀 Mais rápido: ${min}ms`))
  console.log(chalk.white(`  🐢 Mais lento: ${max}ms`))
  
  if (max > 3000) {
    console.log(chalk.yellow(`  ⚠️ Algumas requisições estão lentas (>3s). Pode ser hibernação do Render.`))
  }
  
  await salvarLog()
  
  console.log(chalk.gray('\n✨ Teste de produção finalizado! ✨\n'))
  process.exit(resultados.resumo.falhou === 0 ? 0 : 1)
}

// Executar
executarTestes().catch(async (error) => {
  log.error(`Erro fatal: ${error.message}`)
  await salvarLog()
  process.exit(1)
})