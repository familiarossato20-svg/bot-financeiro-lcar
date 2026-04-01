const { google } = require("googleapis");

let sheetsClient = null;

function getClient() {
  if (sheetsClient) return sheetsClient;

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/**
 * Lança um gasto na planilha
 * @param {Object} dados - Dados financeiros extraídos
 * @param {string} textoOriginal - Transcrição original do áudio
 * @param {string} telefone - Número do WhatsApp do remetente
 */
async function lancarGasto(dados, textoOriginal, telefone) {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR");
  const hora = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const semana = getSemanaDoAno(agora);
  const mes = agora.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Linha para a aba "Lançamentos"
  const linha = [
    data,
    hora,
    dados.tipo.charAt(0).toUpperCase() + dados.tipo.slice(1),
    dados.categoria,
    dados.descricao,
    dados.valor,
    dados.forma_pagamento,
    textoOriginal,
    `Semana ${semana}`,
    mes,
    dados.confianca,
  ];

  // Append na aba Lançamentos
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Lançamentos!A:K",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [linha] },
  });

  return { data, hora, semana, mes };
}

/**
 * Inicializa a planilha com abas e cabeçalhos se ainda não existirem
 */
async function inicializarPlanilha() {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Verifica abas existentes
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const abasExistentes = meta.data.sheets.map((s) => s.properties.title);

  const abasNecessarias = [
    {
      nome: "Lançamentos",
      cabecalho: [
        "Data",
        "Hora",
        "Tipo",
        "Categoria",
        "Descrição",
        "Valor (R$)",
        "Pagamento",
        "Transcrição Original",
        "Semana",
        "Mês",
        "Confiança IA",
      ],
    },
    {
      nome: "📊 Dashboard",
      cabecalho: null, // Será preenchido com fórmulas
    },
  ];

  const requests = [];

  for (const aba of abasNecessarias) {
    if (!abasExistentes.includes(aba.nome)) {
      requests.push({
        addSheet: {
          properties: {
            title: aba.nome,
            gridProperties: { rowCount: 1000, columnCount: 20 },
          },
        },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  // Adiciona cabeçalho na aba Lançamentos se vazia
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Lançamentos!A1",
  });

  if (!check.data.values || check.data.values[0][0] !== "Data") {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Lançamentos!A1:K1",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "Data",
            "Hora",
            "Tipo",
            "Categoria",
            "Descrição",
            "Valor (R$)",
            "Pagamento",
            "Transcrição Original",
            "Semana",
            "Mês",
            "Confiança IA",
          ],
        ],
      },
    });

    // Formata cabeçalho
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = sheetMeta.data.sheets.find(
      (s) => s.properties.title === "Lançamentos"
    )?.properties.sheetId;

    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      fontSize: 11,
                    },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields:
                  "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }

    // Monta dashboard
    await montarDashboard(sheets, spreadsheetId);
  }

  console.log("✅ Planilha inicializada com sucesso");
}

async function montarDashboard(sheets, spreadsheetId) {
  const dashboardData = [
    ["🏦 CONTROLE FINANCEIRO - LCAR + PESSOAL", "", "", ""],
    ["", "", "", ""],
    ["📅 MÊS ATUAL", "", "📅 SEMANA ATUAL", ""],
    [
      "Total Empresarial",
      '=SUMPRODUCT((Lançamentos!C2:C1000="Empresarial")*(MONTH(DATEVALUE(Lançamentos!A2:A1000))=MONTH(TODAY()))*(YEAR(DATEVALUE(Lançamentos!A2:A1000))=YEAR(TODAY()))*Lançamentos!F2:F1000)',
      "Total Empresarial",
      '=SUMPRODUCT((Lançamentos!C2:C1000="Empresarial")*(DATEVALUE(Lançamentos!A2:A1000)>=TODAY()-WEEKDAY(TODAY(),2)+1)*(DATEVALUE(Lançamentos!A2:A1000)<=TODAY())*Lançamentos!F2:F1000)',
    ],
    [
      "Total Pessoal",
      '=SUMPRODUCT((Lançamentos!C2:C1000="Pessoal")*(MONTH(DATEVALUE(Lançamentos!A2:A1000))=MONTH(TODAY()))*(YEAR(DATEVALUE(Lançamentos!A2:A1000))=YEAR(TODAY()))*Lançamentos!F2:F1000)',
      "Total Pessoal",
      '=SUMPRODUCT((Lançamentos!C2:C1000="Pessoal")*(DATEVALUE(Lançamentos!A2:A1000)>=TODAY()-WEEKDAY(TODAY(),2)+1)*(DATEVALUE(Lançamentos!A2:A1000)<=TODAY())*Lançamentos!F2:F1000)',
    ],
    [
      "TOTAL GERAL",
      "=B4+B5",
      "TOTAL GERAL",
      "=D4+D5",
    ],
    ["", "", "", ""],
    ["📊 POR CATEGORIA (MÊS ATUAL)", "", "", ""],
    ["Categoria", "Empresarial", "Pessoal", "Total"],
  ];

  const categorias = [
    "Combustível",
    "Alimentação",
    "Marketing/Anúncios",
    "Manutenção Veículo",
    "Salários",
    "Aluguel/Infraestrutura",
    "Comissões",
    "Impostos/Taxas",
    "Ferramentas/Software",
    "Transporte",
    "Saúde",
    "Lazer/Entretenimento",
    "Casa/Moradia",
    "Outros - Empresarial",
    "Outros - Pessoal",
  ];

  for (const cat of categorias) {
    dashboardData.push([
      cat,
      `=SUMPRODUCT((Lançamentos!D2:D1000="${cat}")*(Lançamentos!C2:C1000="Empresarial")*(MONTH(DATEVALUE(Lançamentos!A2:A1000))=MONTH(TODAY()))*(YEAR(DATEVALUE(Lançamentos!A2:A1000))=YEAR(TODAY()))*Lançamentos!F2:F1000)`,
      `=SUMPRODUCT((Lançamentos!D2:D1000="${cat}")*(Lançamentos!C2:C1000="Pessoal")*(MONTH(DATEVALUE(Lançamentos!A2:A1000))=MONTH(TODAY()))*(YEAR(DATEVALUE(Lançamentos!A2:A1000))=YEAR(TODAY()))*Lançamentos!F2:F1000)`,
      "=B" + (dashboardData.length + 1) + "+C" + (dashboardData.length + 1),
    ]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "📊 Dashboard!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: dashboardData },
  });
}

function getSemanaDoAno(date) {
  const onejan = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
}

module.exports = { lancarGasto, inicializarPlanilha };
