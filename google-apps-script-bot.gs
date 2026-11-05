/**
 * BACKEND GOOGLE APPS SCRIPT COM BOT TELEGRAM
 * Controle Financeiro - Evangelismo Madureira/RJ
 * Planilha: https://docs.google.com/spreadsheets/d/1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI/edit
 */

const SPREADSHEET_ID = "1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI";
const TELEGRAM_TOKEN = "9133687469:AAEp_jcHNbcfe2yoasZ00Q_C9GyRyPAZw1o";
const USUARIOS_AUTORIZADOS = []; // Cole aqui seu ID do Telegram se quiser restringir, ou deixe [] aberto

const DRIVE_FOLDER_ID = ""; // Opcional: ID da pasta no Drive para comprovantes

const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DIAS_SEMANA = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado"
];

/**
 * Função para registrar o Webhook do Telegram (execute esta função uma vez após implantar como Web App)
 */
function configurarWebhookTelegram() {
  const urlWebApp = ScriptApp.getService().getUrl();
  if (!urlWebApp) {
    Logger.log("Erro: Implante o script como App da Web primeiro!");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${encodeURIComponent(urlWebApp)}`;
  const resp = UrlFetchApp.fetch(url);
  Logger.log("Resposta do Telegram: " + resp.getContentText());
}

/**
 * Envia mensagem de volta para o usuário no Telegram
 */
function enviarMensagemTelegram(chatId, texto) {
  if (!TELEGRAM_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: texto,
    parse_mode: "Markdown"
  };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Processa mensagens vindas do Telegram
 */
function processarMensagemTelegram(conteudo) {
  if (!conteudo || !conteudo.message) return;
  const msg = conteudo.message;
  const chatId = msg.chat.id;
  const userId = msg.from ? msg.from.id : null;
  const texto = (msg.text || msg.caption || "").trim();

  // Verifica autorização de usuário
  if (USUARIOS_AUTORIZADOS.length > 0 && !USUARIOS_AUTORIZADOS.includes(userId)) {
    enviarMensagemTelegram(chatId, `⚠️ Seu ID do Telegram é: \`${userId}\`.\nVocê ainda não está autorizado neste bot.`);
    return;
  }

  if (texto === "/start" || texto === "/ajuda") {
    enviarMensagemTelegram(
      chatId,
      `🙌 *Bot Financeiro - Evangelismo Madureira/RJ*\n\n` +
      `📌 *Como lançar:*\n` +
      `• \`Saída 30 refrigerante PIX\`\n` +
      `• \`Entrada 150 oferta culto dinheiro\`\n\n` +
      `🗑️ *Como cancelar/remover:*\n` +
      `• Envie \`/desfazer\` ou \`/cancelar\` para apagar o último lançamento que você fez!\n\n` +
      `📸 *Comprovante:* Envie a foto com a legenda acima!\n\n` +
      `📊 *Dashboard:* https://octaviosoares.github.io/evangelismo-madureira/`
    );
    return;
  }

  // Comando para desfazer / remover o último lançamento
  if (texto === "/desfazer" || texto === "/cancelar" || texto.toLowerCase() === "desfazer" || texto.toLowerCase() === "cancelar") {
    const resRemover = removerUltimoLancamentoDaPlanilha();
    if (resRemover.sucesso) {
      enviarMensagemTelegram(chatId, `🗑️ *Último lançamento desfeito com sucesso!*\nLinha removida: _${resRemover.itemRemovido}_`);
    } else {
      enviarMensagemTelegram(chatId, `⚠️ ${resRemover.mensagem}`);
    }
    return;
  }

  // Interpretar o texto
  const parsed = interpretarTextoLancamento(texto);
  if (!parsed || parsed.valor <= 0) {
    enviarMensagemTelegram(
      chatId,
      `❓ Não entendi o valor ou tipo.\n\nEnvie por exemplo:\n\`Saída 30 refrigerante PIX\` ou\n\`Entrada 200 oferta culto\``
    );
    return;
  }

  let linkComprovante = "";
  // Se enviou foto junto
  if (msg.photo && msg.photo.length > 0) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    linkComprovante = salvarArquivoTelegramNoDrive(fileId, parsed.modalidade);
  }

  // Grava na planilha
  const res = registrarLancamentoNaPlanilha({
    dataObj: new Date(),
    tipo: parsed.tipo,
    modalidade: parsed.modalidade,
    subitem: parsed.subitem,
    valor: parsed.valor,
    formaPagamento: parsed.formaPagamento,
    descricao: parsed.descricao,
    comprovanteUrl: linkComprovante
  });

  const iconeTipo = parsed.tipo === "Entrada" ? "🟢" : "🔴";
  const valorFmt = parsed.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  enviarMensagemTelegram(
    chatId,
    `✅ *Lançamento Registrado!*\n\n` +
    `${iconeTipo} *Tipo:* ${parsed.tipo}\n` +
    `🏷️ *Modalidade:* ${parsed.modalidade}\n` +
    `📝 *Subitem:* ${parsed.subitem}\n` +
    `💰 *Valor:* ${valorFmt}\n` +
    `💳 *Forma:* ${parsed.formaPagamento}\n` +
    `📅 *Aba:* ${res.aba} • ${res.semana}\n` +
    (linkComprovante ? `📎 *Comprovante:* [Ver no Drive](${linkComprovante})\n` : "") +
    `\n📊 [Abrir Dashboard](https://octaviosoares.github.io/evangelismo-madureira/)`
  );
}

/**
 * Inteligência simples para entender a frase digitada
 */
function interpretarTextoLancamento(texto) {
  const t = texto.toLowerCase();

  // Tipo: Entrada ou Saída
  let tipo = "Saída";
  if (t.includes("entrada") || t.includes("oferta") || t.includes("receb") || t.includes("deposito") || t.includes("gazofilacio")) {
    tipo = "Entrada";
  }
  if (t.includes("saida") || t.includes("saída") || t.includes("pago") || t.includes("pagamento") || t.includes("gasto") || t.includes("compra")) {
    tipo = "Saída";
  }

  // Extrair valor monetário (ex: 30, 30.50, 30,50, R$ 30)
  const matchValor = texto.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  let valor = 0;
  if (matchValor) {
    valor = parseFloat(matchValor[1].replace(",", "."));
  }

  // Modalidade
  let modalidade = "Evangelismo";
  if (t.includes("gazofilacio") || t.includes("gazofilácio") || t.includes("culto")) modalidade = "Gazofilácio";
  else if (t.includes("bonificacao") || t.includes("bonificação") || t.includes("ajuda") || t.includes("apoio")) modalidade = "Bonificação";
  else if (t.includes("proposito") || t.includes("propósito") || t.includes("campanha") || t.includes("oracao") || t.includes("oração")) modalidade = "Propósito";
  else if (t.includes("evangelismo") || t.includes("folheto") || t.includes("uber") || t.includes("lanche") || t.includes("refrigerante") || t.includes("agua")) modalidade = "Evangelismo";

  // Forma de pagamento
  let formaPagamento = "PIX";
  if (t.includes("dinheiro")) formaPagamento = "Dinheiro";
  else if (t.includes("debito") || t.includes("débito")) formaPagamento = "Cartão de Débito";
  else if (t.includes("credito") || t.includes("crédito")) formaPagamento = "Cartão de Crédito";
  else if (t.includes("transferencia") || t.includes("transferência")) formaPagamento = "Transferência";

  // Descrição / Subitem
  let limpo = texto
    .replace(/(entrada|saida|saída)/gi, "")
    .replace(/(?:r\$\s*)?\d+(?:[.,]\d{1,2})?/gi, "")
    .replace(/(pix|dinheiro|cartao|cartão|debito|débito|credito|crédito)/gi, "")
    .replace(/(bonificacao|bonificação|evangelismo|gazofilacio|gazofilácio|proposito|propósito)/gi, "")
    .trim();

  let subitem = limpo || (tipo === "Entrada" ? "Oferta Culto" : "Despesa Diversa");
  // Capitaliza
  subitem = subitem.charAt(0).toUpperCase() + subitem.slice(1);

  return {
    tipo,
    modalidade,
    subitem,
    valor,
    formaPagamento,
    descricao: texto
  };
}

/**
 * Salva a foto enviada no Telegram direto na pasta do Google Drive
 */
function salvarArquivoTelegramNoDrive(fileId, modalidade) {
  try {
    const urlGetPath = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`;
    const respPath = JSON.parse(UrlFetchApp.fetch(urlGetPath).getContentText());
    if (!respPath.ok) return "";

    const filePath = respPath.result.file_path;
    const urlDownload = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const blob = UrlFetchApp.fetch(urlDownload).getBlob();

    let pasta;
    if (DRIVE_FOLDER_ID) {
      pasta = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } else {
      const pastas = DriveApp.getFoldersByName("Comprovantes - Evangelismo");
      pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder("Comprovantes - Evangelismo");
    }

    const agora = new Date();
    const nome = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}_${modalidade}_${agora.getTime()}.jpg`;
    blob.setName(nome);
    const arquivo = pasta.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return arquivo.getUrl();
  } catch (e) {
    Logger.log("Erro ao salvar no Drive: " + e.message);
    return "";
  }
}

/**
 * Remove a última linha preenchida na aba do mês atual
 */
function removerUltimoLancamentoDaPlanilha() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const dataObj = new Date();
  const nomeAba = `${MESES_NOMES[dataObj.getMonth()]} ${dataObj.getFullYear()}`;
  const sheet = ss.getSheetByName(nomeAba);

  if (!sheet) return { sucesso: false, mensagem: "Aba do mês não encontrada." };

  const colA = sheet.getRange("A1:A500").getValues();
  let ultimaLinha = -1;
  for (let i = colA.length - 1; i >= 1; i--) {
    if (colA[i][0] && String(colA[i][0]).trim() !== "") {
      ultimaLinha = i + 1;
      break;
    }
  }

  // Não apagar os dois lançamentos iniciais fixos (linhas 2 e 3)
  if (ultimaLinha <= 3) {
    return { sucesso: false, mensagem: "Não há lançamentos recentes para desfazer." };
  }

  const valoresLinha = sheet.getRange(ultimaLinha, 1, 1, 10).getValues()[0];
  const itemRemovido = `${valoresLinha[3]} R$ ${valoresLinha[6]} (${valoresLinha[5]})`;

  // Apaga a linha inteira da planilha
  sheet.deleteRow(ultimaLinha);

  return { sucesso: true, itemRemovido: itemRemovido };
}

/**
 * Grava na aba mensal da planilha
 */
function registrarLancamentoNaPlanilha(item) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const dataObj = item.dataObj || new Date();
  const nomeAba = `${MESES_NOMES[dataObj.getMonth()]} ${dataObj.getFullYear()}`;

  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    sheet = ss.insertSheet(nomeAba, 0);
  }

  const diaSemana = DIAS_SEMANA[dataObj.getDay()];
  const semana = calcularSemanaOficial(dataObj);

  // Acha primeira linha sem Data na Coluna A
  const colA = sheet.getRange("A1:A500").getValues();
  let targetRow = colA.length + 1;
  for (let i = 1; i < colA.length; i++) {
    if (!colA[i][0] || String(colA[i][0]).trim() === "") {
      targetRow = i + 1;
      break;
    }
  }

  sheet.getRange(targetRow, 1).setValue(dataObj);
  sheet.getRange(targetRow, 4, 1, 7).setValues([[
    item.tipo,
    item.modalidade,
    item.subitem,
    item.valor,
    item.formaPagamento,
    item.descricao || "",
    item.comprovanteUrl || ""
  ]]);
  sheet.getRange(targetRow, 7).setNumberFormat("R$ #,##0.00");

  return { aba: nomeAba, semana: semana, linha: targetRow };
}

function calcularSemanaOficial(dateObj) {
  const ano = dateObj.getFullYear();
  const jan1 = new Date(ano, 0, 1);
  const jan1DiaSemana = jan1.getDay();

  const dataLimpa = new Date(ano, dateObj.getMonth(), dateObj.getDate());
  const diffDiasAno = Math.round((dataLimpa - jan1) / (1000 * 60 * 60 * 24));
  const numeroSemana = Math.floor((diffDiasAno + jan1DiaSemana) / 7) + 1;

  const diaSemanaAtual = dataLimpa.getDay();
  let inicioSemana = new Date(ano, dateObj.getMonth(), dateObj.getDate() - diaSemanaAtual);
  let fimSemana = new Date(ano, dateObj.getMonth(), dateObj.getDate() + (6 - diaSemanaAtual));

  if (inicioSemana.getFullYear() < ano) inicioSemana = new Date(ano, 0, 1);
  if (fimSemana.getFullYear() > ano) fimSemana = new Date(ano, 11, 31);

  const formatarCurto = (d) =>
    String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");

  return `Semana ${numeroSemana} (${formatarCurto(inicioSemana)} a ${formatarCurto(fimSemana)})`;
}

/**
 * Webhook que recebe requisições (do Telegram ou do Dashboard)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return HtmlService.createHtmlOutput("OK");
    }

    const postData = JSON.parse(e.postData.contents);

    // Se a requisição veio do Telegram
    if (postData.update_id) {
      // Evita reprocessamento se o Telegram reenviar o mesmo update_id
      const cache = CacheService.getScriptCache();
      const updateKey = "tg_update_" + postData.update_id;
      if (cache.get(updateKey)) {
        return HtmlService.createHtmlOutput("OK");
      }
      cache.put(updateKey, "processado", 300); // guarda por 5 min

      if (postData.message) {
        processarMensagemTelegram(postData);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    // Se for lançamento via API web normal
    const res = registrarLancamentoNaPlanilha({
      dataObj: new Date(postData.data),
      tipo: postData.tipo,
      modalidade: postData.modalidade,
      subitem: postData.subitem,
      valor: Number(postData.valor) || 0,
      formaPagamento: postData.formaPagamento,
      descricao: postData.descricao,
      comprovanteUrl: postData.comprovanteUrl
    });

    return ContentService.createTextOutput(JSON.stringify({ sucesso: true, ...res })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return HtmlService.createHtmlOutput("OK");
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "Bot ativo" })).setMimeType(ContentService.MimeType.JSON);
}
