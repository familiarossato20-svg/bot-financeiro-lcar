const axios = require("axios");

/**
 * Envia mensagem de texto via BotConversa
 * @param {string} telefone - Número no formato 5548XXXXXXXXX
 * @param {string} mensagem - Texto da mensagem
 */
async function enviarMensagem(telefone, mensagem) {
  try {
    await axios.post(
      `https://backend.botconversa.com.br/api/v1/whatsapp-account/send-text/`,
      {
        phone: telefone,
        message: mensagem,
      },
      {
        headers: {
          "API-KEY": process.env.BOTCONVERSA_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log(`✅ Mensagem enviada para ${telefone}`);
  } catch (err) {
    console.error(
      "❌ Erro ao enviar mensagem BotConversa:",
      err.response?.data || err.message
    );
    // Não quebra o fluxo se falhar o envio
  }
}

/**
 * Formata mensagem de confirmação de lançamento
 */
function formatarConfirmacao(dados, dataInfo) {
  const emoji = dados.tipo === "empresarial" ? "🏢" : "👤";
  const valorFormatado = dados.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  let msg = `✅ *Lançamento registrado!*\n\n`;
  msg += `${emoji} *Tipo:* ${dados.tipo.charAt(0).toUpperCase() + dados.tipo.slice(1)}\n`;
  msg += `💰 *Valor:* ${valorFormatado}\n`;
  msg += `📂 *Categoria:* ${dados.categoria}\n`;
  msg += `📝 *Descrição:* ${dados.descricao}\n`;
  msg += `💳 *Pagamento:* ${dados.forma_pagamento}\n`;
  msg += `📅 *Data:* ${dataInfo.data} às ${dataInfo.hora}\n`;

  if (dados.confianca === "baixa") {
    msg += `\n⚠️ _Baixa confiança na extração. Verifique na planilha._`;
  }

  msg += `\n\n📊 _Planilha atualizada!_`;

  return msg;
}

/**
 * Formata mensagem de erro amigável
 */
function formatarErro(motivo) {
  let msg = `⚠️ *Não consegui registrar esse gasto.*\n\n`;

  if (motivo === "sem_valor") {
    msg += `Não identifiquei o *valor* no áudio.\n\n`;
    msg += `Tente assim:\n_"Gastei R$ 150 em combustível da empresa"_`;
  } else if (motivo === "sem_audio") {
    msg += `Manda um *áudio* com o gasto. Texto ainda não é suportado.`;
  } else {
    msg += `Erro interno. Tente novamente em alguns segundos.`;
  }

  return msg;
}

module.exports = { enviarMensagem, formatarConfirmacao, formatarErro };
