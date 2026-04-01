const axios = require("axios");

const CATEGORIAS_EMPRESARIAL = [
  "Combustível",
  "Alimentação",
  "Marketing/Anúncios",
  "Manutenção Veículo",
  "Salários",
  "Aluguel/Infraestrutura",
  "Comissões",
  "Impostos/Taxas",
  "Ferramentas/Software",
  "Frete/Logística",
  "Outros - Empresarial",
];

const CATEGORIAS_PESSOAL = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer/Entretenimento",
  "Vestuário",
  "Casa/Moradia",
  "Educação",
  "Investimentos",
  "Outros - Pessoal",
];

const SYSTEM_PROMPT = `Você é um assistente de controle financeiro. Analisa transcrições de áudio e extrai dados financeiros.

Retorne APENAS um JSON válido, sem explicações, sem markdown.

Formato obrigatório:
{
  "tipo": "empresarial" ou "pessoal",
  "valor": número (ex: 150.00),
  "categoria": string (veja lista abaixo),
  "descricao": string (descrição curta do gasto, máx 50 chars),
  "forma_pagamento": "dinheiro", "pix", "cartão débito", "cartão crédito" ou "não informado",
  "confianca": "alta", "media" ou "baixa"
}

Categorias Empresariais: ${CATEGORIAS_EMPRESARIAL.join(", ")}
Categorias Pessoais: ${CATEGORIAS_PESSOAL.join(", ")}

Regras:
- Se mencionar "empresa", "L-Car", "loja", "negócio", "trabalho" → tipo = empresarial
- Se mencionar "pessoal", "minha", "casa", "família" → tipo = pessoal
- Se ambíguo, use contexto: combustível sem contexto → empresarial (dono de concessionária)
- valor deve ser número puro, sem R$ ou vírgula (ex: 1500.50)
- Se não conseguir extrair valor → confianca = "baixa" e valor = 0`;

/**
 * Extrai dados financeiros do texto transcrito usando Claude
 * @param {string} texto - Texto transcrito do áudio
 * @returns {Object} Dados financeiros estruturados
 */
async function extrairDadosFinanceiros(texto) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcrição do áudio: "${texto}"`,
        },
      ],
    },
    {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 15000,
    }
  );

  const content = response.data.content[0].text.trim();

  // Remove possíveis markdown fences
  const clean = content.replace(/```json|```/g, "").trim();
  const dados = JSON.parse(clean);

  return dados;
}

module.exports = { extrairDadosFinanceiros };
