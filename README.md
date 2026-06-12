## 📊 Diagrama de Caso de Uso (Visão Geral)

```plaintext
+-------------------+       +---------------------+
|     Comprador     |       |    Sistema Automação  |
| (Cliente que paga)|       | (VenomBot/WhatsApp Web|
+-------------------+       |  - Roda localmente)   |
        |                    |  - Usa número da Thaís|
        |                    +---------------------+
        |                              |
        | 1. Compra e preenche dados    |
        |----------------------------->|
        |                              |
        | 2. Sistema gera link único    |
        |    para o presenteado         |
        |                              |
        | 3. [Opcional] Comprador pode  |
        |    copiar link e enviar manual|
        |<-----------------------------|
        |                              |
        | 4. Sistema (automação)        |
        |    envia mensagem da Thaís    |
        |    para o número do presenteado|
        |------------------------------>| (através do WhatsApp Web)
        |                              |
        |                      +-------------------+
        |                      |   Presenteado     |
        |                      | (Quem recebe o    |
        |                      |  presente)        |
        |                      +-------------------+
        |                              |
        |                      | 5. Recebe mensagem da Thaís|
        |                      |    com link para responder |
        |                      |    o questionário           |
        |                      |<----------------------------|
        |                              |
        |                      | 6. Responde anamnese        |
        |                      |    (sua parte como casal)   |
        |                      |-----------------------------|
        |                              |
        | 7. Sistema notifica comprador|
        |    e gera análise final       |
        |<-----------------------------|
```

### Atores e seus papéis:

- **Comprador**:  
  - Realiza o pagamento  
  - Preenche sua anamnese + dados do relacionamento  
  - Opcionalmente, envia o link manualmente (WhatsApp, e-mail)  
  - Recebe confirmação e análise final  

- **Sistema de Automação (VenomBot/WhatsApp Web local)**:  
  - Escuta um webhook ou fila local (Express rodando na máquina da Thaís)  
  - Envia mensagens personalizadas em nome da Thaís para o número do presenteado  
  - Gerencia tentativas e logs  

- **Presenteado**:  
  - Recebe a mensagem da Thaís no WhatsApp  
  - Clica no link e responde o questionário complementar  
  - Aguarda a análise nutricional do casal  

---

## 🧭 Jornada do Cliente (Comprador) – com Pontos Críticos

| Etapa | Ação do Comprador | Emoção / Expectativa | Sistema / Automação | **Pontos Críticos** |
|-------|-------------------|----------------------|---------------------|----------------------|
| **1. Descoberta** | Vê divulgação (Instagram, site) sobre presente de Dia dos Namorados | Curiosidade, desejo de surpreender | - | **Crítico:** A mensagem precisa ser clara sobre o que o presenteado vai receber (evitar frustração) |
| **2. Compra + Anamnese** | Clica em “Comprar”, preenche dados pessoais, anamnese nutricional e responde sobre o relacionamento | Ansiedade, confiança (dados sensíveis) | Salva dados no banco, gera ID do casal | **Crítico:** Validação dos campos obrigatórios; consentimento para uso do número do presenteado |
| **3. Geração do Link** | Sistema gera link único (ex: `site.com/p/abc123`) e apresenta opções de envio | Satisfação parcial, quer entregar rápido | Link fica disponível para o comprador | **Crítico:** Link deve expirar (ex: 48h) para dar urgência |
| **4. Envio do Link (via automação)** | Comprador **informa o número do WhatsApp do presenteado** (campo adicional) + autoriza envio | Expectativa de que o parceiro receba uma mensagem especial | Sistema dispara requisição para o servidor local (Express) → VenomBot envia mensagem da Thaís | **Críticos:** <br>• O computador da Thaís precisa estar ligado com WhatsApp Web logado <br>• Número deve estar no formato internacional <br>• VenomBot pode ser bloqueado se enviar muitas mensagens rápido (rate limit) <br>• O presenteado pode não ter WhatsApp ou estar offline – não há confirmação de entrega |
| **5. (Alternativa) Envio manual** | Comprador copia link e envia por conta própria | Controle total, mas perde o toque personalizado da Thaís | Apenas geração do link | **Crítico:** O comprador pode esquecer de enviar; perde-se o gatilho de lembrete |
| **6. Presenteado recebe a mensagem** | – | Surpresa, validação afetiva | Mensagem com nome do comprador e link personalizado | **Crítico:** A mensagem precisa ser **genuína** (evitar spam) e vir do número verdadeiro da Thaís para criar confiança |
| **7. Presenteado responde questionário** | Clica no link, preenche seus dados de saúde e objetivos do casal | Sentimento de cuidado recíproco | Sistema cruza os dois formulários e gera análise | **Crítico:** O presenteado pode demorar ou não responder. É necessário lembretes automáticos (via WhatsApp ou e-mail). |
| **8. Entrega da análise** | Comprador e presenteado recebem análise por e-mail (PDF) | Realização, gratidão | Geração assíncrona (pode levar até 48h) | **Crítico:** Garantir que o e-mail não caia no spam; oferecer download no site também |
| **9. Pós-venda** | Comprador compartilha experiência, avalia | Fidelização | Gatilhos para próximas datas (ex: aniversário de namoro) | **Crítico:** Manter o número do presenteado para futuras ofertas (com consentimento) |

---

## ⚠️ Pontos Críticos na Execução (O que pode dar errado e como mitigar)

| Ponto Crítico | Impacto | Mitigação |
|---------------|---------|------------|
| **Automação local falhar** (PC desligado, WhatsApp Web desconectado) | Mensagem não é enviada, comprador frustrado | • Mostrar aviso ao comprador: “A mensagem será enviada em até 5 minutos pela Thaís” <br> • Ter um **plano B**: o próprio sistema envia um e-mail para o comprador com o link e instruções de envio manual <br> • Usar um serviço cloud barato (ex: Render free tier) para rodar o VenomBot 24/7 |
| **Número do presenteado inválido** (não tem WhatsApp, digitado errado) | Mensagem nunca chega | • Validar número com regex e pedir confirmação <br> • Oferecer opção de enviar por e-mail também <br> • O comprador pode editar o número depois |
| **VenomBot ser bloqueado pelo WhatsApp** | Conta da Thaís pode ser temporariamente suspensa | • Usar **pausas aleatórias** entre envios (ex: 20-40 segundos) <br> • Não enviar muitas mensagens seguidas (máx 30 por hora) <br> • Preferir a abordagem **manual assistida** (copiar/colar) para lançamento pequeno |
| **Presenteado não abre o link (esquece, desinteresse)** | Perda da conversão, comprador frustrado | • Lembretes automáticos (WhatsApp ou e-mail) após 24h <br> • O comprador pode reenviar manualmente o link <br> • Criar **urgência**: link expira em 48h |
| **Dados sensíveis (anamnese) expostos** | Problemas éticos e LGPD | • Nunca armazenar dados sem criptografia <br> • Pedir consentimento explícito <br> • Anonimizar para análise final |
| **Mensagem da Thaís parecer robótica** | Perde o fator humano | • Usar **variáveis personalizadas** (nome do comprador, nome do presenteado) <br> • Incluir um **áudio curto** (pré-gravado) para dar mais autenticidade <br> • A própria Thaís pode adicionar um emoji ou toque pessoal em cada envio (se for manual assistido) |

-