/**
 * BACKEND GOOGLE APPS SCRIPT COM BOT TELEGRAM
 * Controle Financeiro - Evangelismo Madureira/RJ
 * Planilha: https://docs.google.com/spreadsheets/d/1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI/edit
 */

const SPREADSHEET_ID = "1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI";
const TELEGRAM_TOKEN = "9133687469:AAEp_jcHNbcfe2yoasZ00Q_C9GyRyPAZw1o";
const ADMIN_PIN = "7845"; // PIN de segurança para gerenciar/excluir pelo Dashboard
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
      `💰 *Consultar Saldo:*\n` +
      `• Envie \`/saldo\` para ver o saldo total e do mês!\n\n` +
      `🗑️ *Como remover da planilha (Mês Atual):*\n` +
      `• \`exclua a linha 3\` (apaga a linha 3 do mês atual)\n` +
      `• \`/desfazer\` (apaga o último lançamento feito)\n\n` +
      `📸 *Comprovante:* Envie a foto com a legenda acima!\n\n` +
      `📊 *Dashboard:* https://octaviosoares.github.io/evangelismo-madureira/`
    );
    return;
  }

  // Consulta de Saldo Atual (/saldo ou saldo)
  if (texto === "/saldo" || texto === "saldo") {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataAtual = new Date();
    const nomeAbaAtual = `${MESES_NOMES[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;
    const sheet = ss.getSheetByName(nomeAbaAtual);

    let entMes = 0;
    let saiMes = 0;
    let qtdMovMes = 0;

    if (sheet) {
      const last = sheet.getLastRow();
      if (last > 1) {
        const vals = sheet.getRange(2, 4, last - 1, 4).getValues();
        vals.forEach((r) => {
          const v = typeof r[3] === "number" ? r[3] : parseFloat(String(r[3]).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
          if (v > 0) {
            qtdMovMes++;
            if (r[0] === "Entrada") entMes += v;
            else if (r[0] === "Saída") saiMes += v;
          }
        });
      }
    }

    const saldoMes = entMes - saiMes;
    const saldoGeral = calcularSaldoGeral(ss);
    const formatarMoedaLocal = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    enviarMensagemTelegram(
      chatId,
      `🏦 *SITUAÇÃO DO CAIXA*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 *Saldo Total Acumulado:* *${formatarMoedaLocal(saldoGeral)}*\n\n` +
      `📅 *Mês Atual (${nomeAbaAtual}):*\n` +
      `🟢 Entradas: *+${formatarMoedaLocal(entMes)}*\n` +
      `🔴 Saídas: *-${formatarMoedaLocal(saiMes)}*\n` +
      `💵 Saldo do Mês: *${formatarMoedaLocal(saldoMes)}* (${qtdMovMes} lançamentos)\n\n` +
      `📊 [Abrir Dashboard Completo](https://octaviosoares.github.io/evangelismo-madureira/)`
    );
    return;
  }

  // 1. Comando específico para excluir uma linha informada do mês atual (ex: "exclua a linha 3", "apagar linha 3", "/excluir 3")
  const matchExcluirLinha =
    texto.match(/(?:exclua|excluir|apagar|apague|deletar|delete|\/excluir|\/apagar|\/remover)\s+(?:a\s+)?linha\s*(\d+)/i) ||
    texto.match(/^(?:\/excluir|\/apagar|\/remover)\s+(\d+)$/i);

  if (matchExcluirLinha) {
    const numLinha = parseInt(matchExcluirLinha[1], 10);
    const dataAtual = new Date();
    const nomeAbaAtual = `${MESES_NOMES[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;

    const resRemover = excluirLinhaDaPlanilha(nomeAbaAtual, numLinha, null, ADMIN_PIN);
    if (resRemover.sucesso) {
      const saldoFmt = (resRemover.novoSaldo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      enviarMensagemTelegram(
        chatId,
        `🗑️ *Linha ${numLinha} removida com sucesso!*\n\n` +
        `📅 *Aba:* ${nomeAbaAtual}\n` +
        `📋 *Item apagado:* _${resRemover.itemRemovido}_\n` +
        `🏦 *Novo Saldo Total do Caixa:* *${saldoFmt}*\n\n` +
        `📊 [Abrir Dashboard](https://octaviosoares.github.io/evangelismo-madureira/)`
      );
    } else {
      enviarMensagemTelegram(chatId, `⚠️ ${resRemover.erro || "Não foi possível remover a linha."}`);
    }
    return;
  }

  // 2. Comando geral para desfazer / remover o ÚLTIMO lançamento (ex: "/desfazer", "desfazer", "/cancelar")
  if (
    texto === "/desfazer" ||
    texto === "desfazer" ||
    texto === "/cancelar" ||
    texto === "cancelar" ||
    texto === "/apagar" ||
    texto === "apagar"
  ) {
    const resRemover = removerUltimoLancamentoDaPlanilha();
    if (resRemover.sucesso) {
      enviarMensagemTelegram(chatId, `🗑️ *Último lançamento removido com sucesso!*\n\nItem apagado da planilha:\n_${resRemover.itemRemovido}_`);
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
    dataObj: parsed.dataObj || new Date(),
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
  const saldoAtualFmt = res.saldoGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  enviarMensagemTelegram(
    chatId,
    `✅ *Lançamento Registrado!*\n\n` +
    `${iconeTipo} *Tipo:* ${parsed.tipo}\n` +
    `🏷️ *Modalidade:* ${parsed.modalidade}\n` +
    `📝 *Subitem:* ${parsed.subitem}\n` +
    `💰 *Valor:* ${valorFmt}\n` +
    `💳 *Forma:* ${parsed.formaPagamento}\n` +
    `📅 *Aba:* ${res.aba} • ${res.semana}\n` +
    `🏦 *Saldo Total do Caixa:* *${saldoAtualFmt}*\n` +
    (linkComprovante ? `📎 *Comprovante:* [Ver no Drive](${linkComprovante})\n` : "") +
    `\n📊 [Abrir Dashboard](https://octaviosoares.github.io/evangelismo-madureira/)`
  );
}

/**
 * Inteligência para entender a frase digitada
 */
function interpretarTextoLancamento(texto) {
  const t = texto.toLowerCase();

  // 1. Tipo: Entrada ou Saída
  let tipo = "Saída";
  if (t.includes("entrada") || t.includes("oferta") || t.includes("receb") || t.includes("deposito") || t.includes("gazofilacio")) {
    tipo = "Entrada";
  }
  if (t.includes("saida") || t.includes("saída") || t.includes("pago") || t.includes("pagamento") || t.includes("gasto") || t.includes("compra")) {
    tipo = "Saída";
  }

  // 2. Extrair Data se informada (ex: "dia 05/11", "05/11/2026", "dia 5")
  let dataObj = new Date();
  const matchDataCompleta = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (matchDataCompleta) {
    const dia = parseInt(matchDataCompleta[1], 10);
    const mes = parseInt(matchDataCompleta[2], 10) - 1;
    const ano = matchDataCompleta[3] ? parseInt(matchDataCompleta[3].length === 2 ? "20" + matchDataCompleta[3] : matchDataCompleta[3], 10) : dataObj.getFullYear();
    dataObj = new Date(ano, mes, dia);
  }

  // 3. Extrair Valor Monetário
  // Prioriza se vier com "valor:", "valor", "r$", ou pega o número decimal/moeda
  let valor = 0;
  const matchComRotulo = texto.match(/(?:valor\s*:?|r\$\s*)\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (matchComRotulo) {
    valor = parseFloat(matchComRotulo[1].replace(",", "."));
  } else {
    // Procura números que NÃO sejam a data já encontrada
    const textoSemData = texto.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "").replace(/\bdia\s+\d{1,2}\b/gi, "");
    const matchNumero = textoSemData.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (matchNumero) {
      valor = parseFloat(matchNumero[1].replace(",", "."));
    }
  }

  // 4. Modalidade
  let modalidade = "Evangelismo";
  if (t.includes("gazofilacio") || t.includes("gazofilácio") || t.includes("culto")) modalidade = "Gazofilácio";
  else if (t.includes("bonificacao") || t.includes("bonificação") || t.includes("ajuda") || t.includes("apoio")) modalidade = "Bonificação";
  else if (t.includes("proposito") || t.includes("propósito") || t.includes("campanha") || t.includes("oracao") || t.includes("oração")) modalidade = "Propósito";
  else if (t.includes("evangelismo") || t.includes("folheto") || t.includes("uber") || t.includes("lanche") || t.includes("refrigerante") || t.includes("agua") || t.includes("ovo")) modalidade = "Evangelismo";

  // 5. Forma de pagamento (Padrão: Dinheiro)
  let formaPagamento = "Dinheiro";
  if (t.includes("pix")) formaPagamento = "PIX";
  else if (t.includes("debito") || t.includes("débito")) formaPagamento = "Cartão de Débito";
  else if (t.includes("credito") || t.includes("crédito")) formaPagamento = "Cartão de Crédito";
  else if (t.includes("transferencia") || t.includes("transferência")) formaPagamento = "Transferência";

  // 6. Subitem limpo e legível
  let limpo = texto
    .replace(/(?:saída|saida|entrada)\s*:?/gi, "")
    .replace(/(?:valor\s*:?|r\$\s*)\s*\d+(?:[.,]\d{1,2})?/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "")
    .replace(/\bno\s+dia\b/gi, "")
    .replace(/\bdia\b/gi, "")
    .replace(/\b(pix|dinheiro|cartao|cartão|debito|débito|credito|crédito)\b/gi, "")
    .replace(/\b(bonificacao|bonificação|evangelismo|gazofilacio|gazofilácio|proposito|propósito)\b/gi, "")
    .replace(/[;,\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let subitem = limpo || (tipo === "Entrada" ? "Oferta Culto" : "Despesa Diversa");
  subitem = subitem.charAt(0).toUpperCase() + subitem.slice(1);

  return {
    tipo,
    modalidade,
    subitem,
    valor,
    formaPagamento,
    dataObj,
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

  // Garante a integridade do bloco de RESUMO GERAL na aba
  garantirBlocoResumoGeral(sheet);

  return { sucesso: true, itemRemovido: itemRemovido };
}

/**
 * Garante as fórmulas do RESUMO GERAL (L1:M4) na aba
 */
function garantirBlocoResumoGeral(sheet) {
  try {
    sheet.getRange("L1:M4").setValues([
      ["RESUMO GERAL", ""],
      ["Total Entradas", '=SUMIF(D2:D; "Entrada"; G2:G)'],
      ["Total Saídas", '=SUMIF(D2:D; "Saída"; G2:G)'],
      ["SALDO ATUAL", '=M2-M3']
    ]);
  } catch (e) {}
}

/**
 * Exclui uma linha específica da planilha (solicitado pelo Telegram ou Dashboard com PIN)
 */
function excluirLinhaDaPlanilha(aba, linha, subitem, pin) {
  if (String(pin).trim() !== ADMIN_PIN) {
    return { sucesso: false, erro: "Acesso negado: PIN de administrador incorreto ou ausente." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const dataObj = new Date();
  const nomeAba = aba || `${MESES_NOMES[dataObj.getMonth()]} ${dataObj.getFullYear()}`;
  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return { sucesso: false, erro: `Aba "${nomeAba}" não encontrada.` };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { sucesso: false, erro: `A aba "${nomeAba}" está vazia.` };

  let linhaAlvo = parseInt(linha, 10);

  if (linhaAlvo <= 1) {
    return { sucesso: false, erro: "Não é permitido excluir a linha 1 (cabeçalho da planilha)." };
  }

  // Se informou subitem, valida se a linha indicada ainda corresponde
  if (subitem && linhaAlvo >= 2 && linhaAlvo <= lastRow) {
    const valF = sheet.getRange(linhaAlvo, 6).getValue();
    if (String(valF).trim().toLowerCase() !== String(subitem).trim().toLowerCase()) {
      linhaAlvo = -1;
    }
  }

  // Se não coincidiu pelo número, procura em toda a coluna F (Subitem)
  if (linhaAlvo < 2 && subitem) {
    const colF = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
    for (let i = 0; i < colF.length; i++) {
      if (String(colF[i][0]).trim().toLowerCase() === String(subitem).trim().toLowerCase()) {
        linhaAlvo = i + 2;
        break;
      }
    }
  }

  if (linhaAlvo < 2 || linhaAlvo > lastRow) {
    return { sucesso: false, erro: `A linha ${linha} não existe ou está vazia na aba ${nomeAba}.` };
  }

  const valores = sheet.getRange(linhaAlvo, 1, 1, 10).getValues()[0];
  const itemRemovido = `${valores[3] || "Item"} R$ ${valores[6] || "0,00"} (${valores[5] || "Geral"})`;

  // Apaga a linha na planilha
  sheet.deleteRow(linhaAlvo);

  // Garante o resumo geral intacto
  garantirBlocoResumoGeral(sheet);
  SpreadsheetApp.flush();

  const novoSaldo = calcularSaldoGeral(ss);

  return { sucesso: true, itemRemovido: itemRemovido, linhaExcluida: linhaAlvo, aba: nomeAba, novoSaldo: novoSaldo };
}

/**
 * Atualiza campos de uma linha existente na planilha (Tipo, Modalidade, Forma de Pagamento com PIN)
 */
function atualizarLinhaNaPlanilha(aba, linha, subitem, tipo, modalidade, formaPagamento, pin) {
  if (String(pin).trim() !== ADMIN_PIN) {
    return { sucesso: false, erro: "Acesso negado: PIN de administrador incorreto ou ausente." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(aba);
  if (!sheet) return { sucesso: false, erro: "Aba não encontrada" };

  const lastRow = sheet.getLastRow();
  let linhaAlvo = parseInt(linha, 10);

  if (subitem && linhaAlvo >= 2 && linhaAlvo <= lastRow) {
    const valF = sheet.getRange(linhaAlvo, 6).getValue();
    if (String(valF).trim().toLowerCase() !== String(subitem).trim().toLowerCase()) {
      linhaAlvo = -1;
    }
  }

  if (linhaAlvo < 2 && subitem) {
    const colF = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
    for (let i = 0; i < colF.length; i++) {
      if (String(colF[i][0]).trim().toLowerCase() === String(subitem).trim().toLowerCase()) {
        linhaAlvo = i + 2;
        break;
      }
    }
  }

  if (linhaAlvo < 2 || linhaAlvo > lastRow) {
    return { sucesso: false, erro: "Linha não encontrada" };
  }

  // Coluna D: Tipo, Coluna E: Modalidade, Coluna H: Forma de Pagamento
  if (tipo) sheet.getRange(linhaAlvo, 4).setValue(tipo);
  if (modalidade) sheet.getRange(linhaAlvo, 5).setValue(modalidade);
  if (formaPagamento) sheet.getRange(linhaAlvo, 8).setValue(formaPagamento);

  SpreadsheetApp.flush();
  return { sucesso: true, linha: linhaAlvo };
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
  sheet.getRange(targetRow, 1, 1, 10).setVerticalAlignment("middle");
  sheet.getRange(targetRow, 1, 1, 9).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.getRange(targetRow, 10).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  // Garante bloco de RESUMO GERAL na aba
  sheet.getRange("L1:M4").setValues([
    ["RESUMO GERAL", ""],
    ["Total Entradas", '=SUMIF(D2:D; "Entrada"; G2:G)'],
    ["Total Saídas", '=SUMIF(D2:D; "Saída"; G2:G)'],
    ["SALDO ATUAL", '=M2-M3']
  ]);

  SpreadsheetApp.flush();

  // Calcula o Saldo Total Geral de todas as abas
  const saldoGeral = calcularSaldoGeral(ss);

  return { aba: nomeAba, semana: semana, linha: targetRow, saldoGeral: saldoGeral };
}

/**
 * Calcula o saldo total consolidado de todas as abas da planilha
 */
function calcularSaldoGeral(ss) {
  let saldoGeral = 0;
  ss.getSheets().forEach((s) => {
    const last = s.getLastRow();
    if (last > 1) {
      const vals = s.getRange(2, 4, last - 1, 4).getValues();
      vals.forEach((r) => {
        const v = typeof r[3] === "number" ? r[3] : parseFloat(String(r[3]).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
        if (r[0] === "Entrada") saldoGeral += v;
        else if (r[0] === "Saída") saldoGeral -= v;
      });
    }
  });
  return saldoGeral;
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

    // Ação: Excluir linha pelo dashboard (requer PIN)
    if (postData.acao === "excluirLinha") {
      const res = excluirLinhaDaPlanilha(postData.aba, postData.linha, postData.subitem, postData.pin);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    // Ação: Atualizar campos da linha pelo dashboard (requer PIN)
    if (postData.acao === "atualizarLinha") {
      const res = atualizarLinhaNaPlanilha(postData.aba, postData.linha, postData.subitem, postData.tipo, postData.modalidade, postData.formaPagamento, postData.pin);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    // Se for lançamento via API web do dashboard, valida PIN
    if (String(postData.pin).trim() !== ADMIN_PIN) {
      return ContentService.createTextOutput(JSON.stringify({ sucesso: false, erro: "Acesso negado: PIN de administrador incorreto ou ausente." })).setMimeType(ContentService.MimeType.JSON);
    }

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
    return ContentService.createTextOutput(JSON.stringify({ sucesso: false, erro: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const acao = p.acao;

    if (acao === "excluirLinha") {
      const res = excluirLinhaDaPlanilha(p.aba, p.linha, p.subitem, p.pin);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === "atualizarLinha") {
      const res = atualizarLinhaNaPlanilha(p.aba, p.linha, p.subitem, p.tipo, p.modalidade, p.formaPagamento, p.pin);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "Bot ativo", timestamp: new Date() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "erro", mensagem: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
