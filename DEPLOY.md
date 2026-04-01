# 🏦 Bot Financeiro WhatsApp - Guia de Deploy
**Zero código. Siga passo a passo.**

---

## ✅ PASSO 1 — Criar conta no GitHub (se não tiver)
1. Acesse https://github.com e crie uma conta gratuita
2. Clique em **"New repository"**
3. Nome: `bot-financeiro`
4. Deixe **Public**
5. Clique **"Create repository"**

---

## ✅ PASSO 2 — Subir os arquivos no GitHub
1. Na página do repositório, clique **"uploading an existing file"**
2. Arraste TODOS os arquivos desta pasta
3. Clique **"Commit changes"**

---

## ✅ PASSO 3 — Deploy no Railway (GRÁTIS)
1. Acesse https://railway.app e faça login com sua conta GitHub
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha `bot-financeiro`
5. Railway vai detectar automaticamente e começar o deploy

---

## ✅ PASSO 4 — Configurar as variáveis de ambiente no Railway
Na tela do projeto no Railway, clique em **"Variables"** e adicione:

| Variável | Onde pegar | 
|---|---|
| `GROQ_API_KEY` | https://console.groq.com → API Keys → Create |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `BOTCONVERSA_API_KEY` | BotConversa → Configurações → Integrações → API |
| `GOOGLE_SHEET_ID` | URL da planilha: `docs.google.com/spreadsheets/d/**ESTE_ID**/edit` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Veja Passo 5 abaixo |

---

## ✅ PASSO 5 — Configurar Google Sheets (Service Account)

### 5.1 — Criar projeto no Google Cloud
1. Acesse https://console.cloud.google.com
2. Clique em **"Novo Projeto"** → nome: `bot-financeiro` → Criar
3. No menu lateral: **APIs e Serviços → Biblioteca**
4. Busque **"Google Sheets API"** → Ativar

### 5.2 — Criar Service Account
1. Menu lateral: **APIs e Serviços → Credenciais**
2. Clique **"Criar Credenciais" → "Conta de Serviço"**
3. Nome: `bot-financeiro` → Criar e Continuar → Concluir
4. Clique na conta criada → aba **"Chaves"**
5. **"Adicionar Chave" → "Criar nova chave" → JSON → Criar**
6. Um arquivo `.json` será baixado — **guarde bem!**

### 5.3 — Criar a planilha e compartilhar
1. Acesse https://sheets.google.com e crie uma planilha nova
2. Nomeie como: `Controle Financeiro LCAR`
3. Copie o ID da URL (entre `/d/` e `/edit`)
4. Abra o arquivo JSON baixado e copie o valor de `"client_email"` (algo como `bot-financeiro@projeto.iam.gserviceaccount.com`)
5. Na planilha, clique em **"Compartilhar"** e cole esse e-mail com permissão de **Editor**

### 5.4 — Colocar o JSON no Railway
1. Abra o arquivo JSON baixado no bloco de notas
2. Selecione TODO o conteúdo (Ctrl+A) e copie (Ctrl+C)
3. No Railway, crie a variável `GOOGLE_SERVICE_ACCOUNT_JSON` e cole o conteúdo

---

## ✅ PASSO 6 — Pegar a URL do seu bot
1. No Railway, clique em **"Settings" → "Domains"**
2. Clique **"Generate Domain"**
3. Sua URL será algo como: `https://bot-financeiro-production.up.railway.app`
4. Anote essa URL — você vai usar no próximo passo

---

## ✅ PASSO 7 — Configurar webhook no BotConversa
1. No BotConversa, vá em **Configurações → Webhooks** (ou Integrações → Webhook)
2. Adicione novo webhook:
   - **URL:** `https://SUA-URL.up.railway.app/webhook/financeiro`
   - **Eventos:** Selecione **"Mensagem recebida"**
3. Salve

---

## ✅ PASSO 8 — Testar!
Mande um áudio no WhatsApp dizendo:
> *"Gastei cento e cinquenta reais em combustível da empresa"*

Você deve receber uma confirmação e ver o lançamento na planilha.

---

## 🧪 Teste manual via API
Acesse no navegador ou use o Postman:
```
POST https://SUA-URL.up.railway.app/webhook/teste
Content-Type: application/json

{
  "texto": "Gastei 200 reais em almoço pessoal",
  "telefone": "5548999999999"
}
```

---

## 💬 Exemplos de como falar para o bot entender

✅ **Funciona bem:**
- *"Gastei R$ 150 em combustível da empresa"*
- *"Paguei 80 reais de almoço pessoal no cartão de crédito"*
- *"Lancei 1200 reais em anúncios Meta da loja hoje"*
- *"Gastei cinquenta reais de Uber pessoal"*

❌ **Evite:**
- Valores muito ambíguos sem contexto
- Falar muito rápido ou com muito ruído

---

## 💰 Custos estimados

| Serviço | Custo |
|---|---|
| Railway | **$5 USD/mês** (crédito grátis inicial) |
| Groq Whisper | **Grátis** (generoso) |
| Claude Haiku | **~R$0,01 por lançamento** |
| Google Sheets | **Grátis** |
| **TOTAL** | **~R$25/mês** |

---

## 🆘 Problemas comuns

**Bot não responde:**
- Verifique os logs no Railway (aba "Deployments → View Logs")
- Confirme que o webhook foi salvo no BotConversa

**Planilha não atualiza:**
- Verifique se compartilhou a planilha com o e-mail da Service Account
- Confira se o `GOOGLE_SHEET_ID` está correto

**"Baixa confiança" frequente:**
- Fale mais devagar e mencione explicitamente o valor em reais
