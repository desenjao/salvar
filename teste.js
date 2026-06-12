// teste.js — ES Module (funciona com "type": "module" no package.json)
import axios from 'axios';

// Configuração
const BASE_URL = 'http://localhost:3333';
const ROTA = '/api/namorados/quiz';

// Função para log colorido
const log = {
  info: (msg) => console.log('\x1b[34mℹ️\x1b[0m', msg),
  success: (msg) => console.log('\x1b[32m✅\x1b[0m', msg),
  error: (msg) => console.log('\x1b[31m❌\x1b[0m', msg),
  warn: (msg) => console.log('\x1b[33m⚠️\x1b[0m', msg),
  data: (obj) => console.log('\x1b[36m📦\x1b[0m', JSON.stringify(obj, null, 2))
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Teste 1: Comprador criando presente
async function testeComprador() {
  console.log('\n' + '='.repeat(60));
  log.info('TESTE 1: Comprador criando presente');
  console.log('='.repeat(60));
  
  const payload = {
    tipoUsuario: 'COMPRADOR',
    nome: 'João Silva',
    telefone: '(11) 99999-1111',
    email: 'joao@teste.com',
    anamnese: {
      data_nascimento: '15/03/1990',
      signo: 'Peixes',
      cor_preferida: 'Azul',
      hobby_favorito: 'Jogar videogame',
      comida_preferida: 'Pizza',
      musica_preferida: 'Rock'
    },
    relacionamento: {
      como_conheceram: 'Amigos em comum',
      tempo_juntos: '3 anos',
      qualidade_parceiro: 'Carinhoso e atencioso',
      planos_futuro: 'Viajar mais juntos'
    },
    mensagem: 'Oi amor! Respondi esse quiz pensando em você. Quero muito ver suas respostas! Te amo 💕'
  };
  
  log.info(`Enviando POST para: ${BASE_URL}${ROTA}`);
  
  try {
    const response = await axios.post(`${BASE_URL}${ROTA}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    log.success('Resposta recebida!');
    log.data(response.data);
    
    if (response.data.success && response.data.casalId) {
      log.success(`✨ CASAL ID GERADO: ${response.data.casalId}`);
      log.info(`🔗 Link: ${BASE_URL}/presente?casalId=${response.data.casalId}`);
      return response.data.casalId;
    }
    return null;
  } catch (error) {
    log.error('Erro na requisição:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados:', error.response.data);
    } else if (error.request) {
      console.log('Servidor não respondeu. Verifique se está rodando em', BASE_URL);
    } else {
      console.log('Erro:', error.message);
    }
    return null;
  }
}

// Teste 2: Presenteado respondendo
async function testePresenteado(casalId) {
  console.log('\n' + '='.repeat(60));
  log.info(`TESTE 2: Presenteado respondendo (casalId: ${casalId})`);
  console.log('='.repeat(60));
  
  if (!casalId) return false;
  
  const payload = {
    casalId: casalId,
    tipoUsuario: 'PRESENTEADO',
    nome: 'Maria Santos',
    telefone: '(11) 99999-2222',
    email: 'maria@teste.com',
    anamnese: {
      data_nascimento: '22/07/1992',
      signo: 'Câncer',
      cor_preferida: 'Rosa',
      hobby_favorito: 'Fazer trilha',
      comida_preferida: 'Lasanha',
      musica_preferida: 'MPB'
    },
    relacionamento: {
      como_conheceram: 'Academia',
      tempo_juntos: '3 anos',
      qualidade_parceiro: 'Engraçado e parceiro',
      o_que_mais_gosta: 'Carinho e atenção'
    }
  };
  
  try {
    const response = await axios.post(`${BASE_URL}${ROTA}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    log.success('Resposta recebida!');
    log.data(response.data);
    
    if (response.data.success) {
      log.success('🎉 Presente respondido com sucesso!');
      return true;
    }
    return false;
  } catch (error) {
    log.error('Erro:', error.response?.data || error.message);
    return false;
  }
}

// Teste 3: Tentar responder duas vezes
async function testeDuplicado(casalId) {
  console.log('\n' + '='.repeat(60));
  log.warn('TESTE 3: Tentando responder novamente (deve falhar)');
  console.log('='.repeat(60));
  
  if (!casalId) return;
  
  const payload = {
    casalId: casalId,
    tipoUsuario: 'PRESENTEADO',
    nome: 'Outra Maria',
    telefone: '(11) 99999-3333',
    anamnese: {},
    relacionamento: {}
  };
  
  try {
    await axios.post(`${BASE_URL}${ROTA}`, payload);
    log.warn('⚠️ Conseguiu responder duas vezes!');
  } catch (error) {
    if (error.response?.status === 400) {
      log.success('✅ Correto! Bloqueou segunda resposta.');
      log.data(error.response.data);
    } else {
      log.error('Erro:', error.message);
    }
  }
}

// Teste 4: ID inválido
async function testeIdInvalido() {
  console.log('\n' + '='.repeat(60));
  log.warn('TESTE 4: ID inválido (deve falhar)');
  console.log('='.repeat(60));
  
  const payload = {
    casalId: '00000000-0000-0000-0000-000000000000',
    tipoUsuario: 'PRESENTEADO',
    nome: 'Teste',
    anamnese: {},
    relacionamento: {}
  };
  
  try {
    await axios.post(`${BASE_URL}${ROTA}`, payload);
    log.warn('⚠️ ID inválido aceito!');
  } catch (error) {
    if (error.response?.status === 404) {
      log.success('✅ Correto! Retornou 404.');
      log.data(error.response.data);
    } else {
      log.error('Erro:', error.message);
    }
  }
}

// Teste 5: Presenteado sem comprador
async function testeSemComprador() {
  console.log('\n' + '='.repeat(60));
  log.warn('TESTE 5: Presenteado sem comprador (deve falhar)');
  console.log('='.repeat(60));
  
  const payload = {
    tipoUsuario: 'PRESENTEADO',
    nome: 'Teste Solitário',
    anamnese: {},
    relacionamento: {}
  };
  
  try {
    await axios.post(`${BASE_URL}${ROTA}`, payload);
    log.warn('⚠️ Presenteado conseguiu criar sozinho!');
  } catch (error) {
    if (error.response?.status === 400) {
      log.success('✅ Correto! Bloqueou presenteado sem casalId.');
      log.data(error.response.data);
    } else {
      log.error('Erro:', error.message);
    }
  }
}

// Função principal
async function executarTestes() {
  console.clear();
  console.log('\n🚀 TESTES DA ROTA /api/namorados/quiz');
  console.log(`📍 ${BASE_URL}${ROTA}`);
  console.log(`⏰ ${new Date().toLocaleString()}\n`);
  
  // Testa conexão com o servidor
  try {
    await axios.get(BASE_URL, { timeout: 5000 });
    log.success('Servidor online!');
  } catch (error) {
    log.error(`Servidor não está respondendo em ${BASE_URL}`);
    log.warn('Certifique-se de que o servidor está rodando');
    process.exit(1);
  }
  
  const casalId = await testeComprador();
  await delay(2000);
  
  if (casalId) {
    await testePresenteado(casalId);
    await delay(2000);
    await testeDuplicado(casalId);
    await delay(2000);
  }
  
  await testeIdInvalido();
  await delay(2000);
  await testeSemComprador();
  
  console.log('\n' + '='.repeat(60));
  log.success('🏁 TESTES CONCLUÍDOS!');
  console.log('='.repeat(60));
  console.log('\n💡 Verifique os logs do servidor para ver os PDFs sendo gerados\n');
}

// Tratamento de erros
process.on('unhandledRejection', (err) => {
  console.error('🔥 Erro não tratado:', err.message);
});

// Executar
executarTestes();