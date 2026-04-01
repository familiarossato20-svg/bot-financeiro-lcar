require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const { transcribeAudio } = require("./transcribe");
const { extrairDadosFinanceiros } = require("./extract");
const { lancarGasto, inicializarPlanilha } = require("./sheets");

const NUMERO_AUTORIZADO = process.env.NUMERO_AUTORIZADO || "";

let sock = null;

async function enviarMensagem(jid, texto) {
  try {
    if (!sock) return;
    await sock.sendMessage(jid, { text: texto });
    console.log("✅ Mensagem enviada para " + jid);
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
  }
}

function formatarConfirmacao(dados, dataInfo) {
  const emoji = dados.tipo === "empresarial" ? "🏢" : "👤";
  const valorFormatado = "R$ " + dados.valor.toFixed(2).replace(".", ",");
  let msg = "✅ *Lançamento registrado!*\n\n";
  msg += emoji + " *Tipo:* " + dados.tipo.charAt(0).toUpperCase() + dados.tipo.slice(1) + "\n";
  msg += "💰 *Valor:* " + valorFormatado + "\n";
  msg += "📂 *Categoria:* " + dados.categoria + "\n";
  msg += "📝 *Descrição:* " + dados.descricao + "\n";
  msg += "💳 *Pagamento:* " + dados.forma_pagamento + "\n";
  msg += "📅 *Data:* " + dataInfo.data + " às " + dataInfo.hora + "\n";
  if (dados.confianca === "baixa") msg += "\n⚠️ _Baixa confiança. Verifique na planilha._";
  msg += "\n\n📊 _Planilha atualizada!_";
  return msg;
}

async function processarMensagem(jid, tipo, conteudo) {
  let transcricao = "";
  try {
    if (tipo === "audio") {
      console.log("🎤 Áudio recebido de " + jid);
      transcricao = await transcribeAudio(conteudo.buffer, conteudo.mimeType);
      console.log("📝 Transcrição: \"" + transcricao + "\"");
      if (!transcricao || transcricao.length < 3) {
        await enviarMensagem(jid, "⚠️ Não entendi o áudio. Tente falar mais devagar.");
        return;
      }
    } else if (tipo === "texto") {
      transcricao = conteudo.texto;
      console.log("💬 Texto: \"" + transcricao + "\"");
    } else {
      await enviarMensagem(jid, "💡 Manda um áudio ou texto com o gasto.\nEx: _\"Gastei 150 em combustível da empresa\"_");
      return;
    }

    const dados = await extrairDadosFinanceiros(transcricao);
    console.log("💡 Dados:", dados);

    if (!dados.valor || dados.valor === 0) {
      await enviarMensagem(jid, "⚠️ Não identifiquei o *valor*.\nTente: _\"Gastei R$ 150 em combustível da empresa\"_");
      return;
    }

    const dataInfo = await lancarGasto(dados, transcricao, jid);
    await enviarMensagem(jid, formatarConfirmacao(dados, dataInfo));

  } catch (err) {
    console.error("❌ Erro:", err.message);
    await enviarMensagem(jid, "❌ Erro interno. Tente novamente.");
  }
}

async function conectarWhatsApp() {
  const authDir = path.join(__dirname, "../auth_info");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: require("pino")({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📱 ESCANEIE O QR CODE ABAIXO NO WHATSAPP:\n");
      qrcode.generate(qr, { small: true });
      console.log("\n(WhatsApp > ... > Dispositivos conectados > Conectar dispositivo)\n");
    }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reconectar = code !== DisconnectReason.loggedOut;
      console.log("🔴 Conexão encerrada. Reconectar: " + reconectar);
      if (reconectar) setTimeout(conectarWhatsApp, 3000);
      else console.log("🚪 Deslogado. Delete auth_info e reinicie.");
    }
    if (connection === "open") {
      console.log("✅ WhatsApp conectado!");
      try { await inicializarPlanilha(); } catch (e) { console.error("⚠️ Planilha:", e.message); }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;

      if (NUMERO_AUTORIZADO) {
        const num = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        if (!NUMERO_AUTORIZADO.includes(num)) { console.log("⚠️ Ignorado: " + jid); continue; }
      }

      const m = msg.message;
      if (m.audioMessage || m.pttMessage) {
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          const mimeType = (m.audioMessage || m.pttMessage).mimetype || "audio/ogg; codecs=opus";
          await processarMensagem(jid, "audio", { buffer, mimeType });
        } catch (e) {
          console.error("❌ Áudio:", e.message);
          await enviarMensagem(jid, "❌ Erro ao processar áudio.");
        }
        continue;
      }

      const texto = m.conversation || m.extendedTextMessage?.text;
      if (texto && texto.trim().length > 3) {
        await processarMensagem(jid, "texto", { texto: texto.trim() });
      }
    }
  });
}

console.log("🚀 Iniciando bot financeiro WhatsApp (Baileys)...");
conectarWhatsApp();
