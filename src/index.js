require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { transcribeAudio } = require("./transcribe");
const { extrairDadosFinanceiros } = require("./extract");
const { lancarGasto, inicializarPlanilha } = require("./sheets");
const {
  enviarMensagem,
  formatarConfirmacao,
  formatarErro,
} = require("./whatsapp");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/", (req, res) => {
  res.json({
    status: "🟢 Bot financeiro online",
    versao: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// WEBHOOK PRINCIPAL - BotConversa
// ============================================================
app.post("/webhook/financeiro", async (req, res) => {
  // Responde imediatamente para o BotConversa não dar timeout
  res.status(200).json({ received: true });

  try {
    const payload = req.body;
    console.log("📩 Webhook recebido:", JSON.stringify(payload, null, 2));

    // Extrai dados do payload do BotConversa
    const telefone = extrairTelefone(payload);
    const tipoMensagem = extrairTipoMensagem(payload);
    const audioUrl = extrairAudioUrl(payload);
    const textoMensagem = extrairTexto(payload);

    if (!telefone) {
      console.log("⚠️ Telefone não encontrado no payload");
      return;
    }

    let transcricao = "";

    if (tipoMensagem === "audio" && audioUrl) {
      // --- FLUXO ÁUDIO ---
      console.log(`🎤 Áudio recebido de ${telefone}: ${audioUrl}`);

      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "API-KEY": process.env.BOTCONVERSA_API_KEY },
      });

      const audioBuffer = Buffer.from(audioResponse.data);
      const mimeType = audioResponse.headers["content-type"] || "audio/ogg";
      console.log(`📥 Áudio baixado: ${audioBuffer.length} bytes, tipo: ${mimeType}`);

      transcricao = await transcribeAudio(audioBuffer, mimeType);
      console.log(`📝 Transcrição: "${transcricao}"`);

      if (!transcricao || transcricao.length < 3) {
        await enviarMensagem(telefone, "⚠️ Não consegui entender o áudio. Tente falar mais devagar.");
        return;
      }

    } else if (textoMensagem && textoMensagem.length > 3) {
      // --- FLUXO TEXTO ---
      transcricao = textoMensagem;
      console.log(`💬 Texto recebido de ${telefone}: "${transcricao}"`);

    } else {
      await enviarMensagem(
        telefone,
        "💡 Manda um áudio ou texto descrevendo o gasto.\n\nExemplo: _\"Gastei 150 reais em combustível da empresa\"_"
      );
      return;
    }

    // 3. Extrai dados financeiros com Claude
    const dados = await extrairDadosFinanceiros(transcricao);
    console.log("💡 Dados extraídos:", dados);

    if (!dados.valor || dados.valor === 0) {
      await enviarMensagem(telefone, formatarErro("sem_valor"));
      return;
    }

    // 4. Lança na planilha
    const dataInfo = await lancarGasto(dados, transcricao, telefone);
    console.log("✅ Lançado na planilha:", dataInfo);

    // 5. Confirma para o usuário
    const confirmacao = formatarConfirmacao(dados, dataInfo);
    await enviarMensagem(telefone, confirmacao);

  } catch (err) {
    console.error("❌ Erro no processamento:", err.message, err.stack);
  }
});

// ============================================================
// ENDPOINT DE TESTE (para verificar se está funcionando)
// ============================================================
app.post("/webhook/teste", async (req, res) => {
  try {
    const { texto, telefone } = req.body;

    if (!texto) {
      return res.json({ erro: "Envie um campo 'texto' para testar" });
    }

    const dados = await extrairDadosFinanceiros(texto);
    const dataInfo = await lancarGasto(dados, texto, telefone || "5548000000000");
    const confirmacao = formatarConfirmacao(dados, dataInfo);

    res.json({
      transcricao: texto,
      dados_extraidos: dados,
      confirmacao_formatada: confirmacao,
      status: "✅ Lançado com sucesso",
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ============================================================
// HELPERS - Extração de dados do payload BotConversa
// ============================================================

function extrairTelefone(payload) {
  return (
    payload?.phone ||
    payload?.subscriber?.phone ||
    payload?.contact?.phone ||
    payload?.data?.phone ||
    null
  );
}

function extrairTipoMensagem(payload) {
  const tipo = (
    payload?.message_type ||
    payload?.type ||
    payload?.message?.type ||
    ""
  ).toLowerCase();

  if (tipo.includes("audio") || tipo.includes("voice") || tipo.includes("ptt"))
    return "audio";
  if (tipo.includes("text")) return "text";

  // Se tem audio_url mas não tem tipo, assume audio
  if (payload?.audio_url || payload?.media_url) return "audio";
  // Se tem texto, assume text
  if (payload?.text || payload?.message_text || payload?.body) return "text";

  return tipo;
}

function extrairAudioUrl(payload) {
  return (
    payload?.audio_url ||
    payload?.media_url ||
    payload?.message?.url ||
    payload?.file_url ||
    null
  );
}

function extrairTexto(payload) {
  return (
    payload?.text ||
    payload?.message_text ||
    payload?.body ||
    payload?.message?.text ||
    payload?.last_message ||
    null
  );
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Bot financeiro rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/financeiro`);

  // Inicializa planilha automaticamente
  try {
    await inicializarPlanilha();
  } catch (err) {
    console.error(
      "⚠️ Erro ao inicializar planilha (verifique as credenciais):",
      err.message
    );
  }
});
