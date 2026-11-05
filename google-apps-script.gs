/**
 * BACKEND E AUTOMAÇÃO GOOGLE APPS SCRIPT - CONTROLE FINANCEIRO EVANGELISMO
 * Planilha Oficial: https://docs.google.com/spreadsheets/d/1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI/edit
 */

const SPREADSHEET_ID = "1Im_dY58z0tP7rOhLVFy5xWTAg19CV27v8X_XfTOj2zI";
const DRIVE_FOLDER_ID = ""; // Opcional: ID da pasta de comprovantes no Google Drive

const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DIAS_SEMANA = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado"
];

const MODALIDADES_OFICIAIS = [
  "Bonificação",
  "Evangelismo",
  "Gazofilácio",
  "Propósito"
];

const FORMAS_PAGAMENTO = [
  "PIX",
  "Dinheiro",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Transferência"
];

const CABECALHOS = [
  "Data",
  "Dia da Semana",
  "Semana (Dom-Sáb)",
  "Tipo",
  "Modalidade",
  "Subitem",
  "Valor (R$)",
  "Forma de Pagamento",
  "Descrição / Observação",
  "Link do Comprovante"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚡ Evangelismo")
    .addItem("Configurar / Atualizar Abas e Setas (Dropdowns)", "configurarPlanilhaCompleta")
    .addItem("Criar Aba do Mês Atual", "criarAbaMesAtualManual")
    .addToUi();
}

function configurarPlanilhaCompleta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoje = new Date();
  obterOuCriarAbaMensal(ss, hoje);

  const regexAbaMensal = /^(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+\d{4}$/i;
  ss.getSheets().forEach((sheet) => {
    if (regexAbaMensal.test(sheet.getName()) || ss.getSheets().length === 1) {
      aplicarDropdownsEFormatacaoNaAba(sheet, 200);
    }
  });
}

function criarAbaMesAtualManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  obterOuCriarAbaMensal(ss, new Date());
}

/**
 * Encontra a primeira linha vazia na Coluna A (Data), ignorando linhas que só possuem fórmula em B e C
 */
function encontrarProximaLinhaVazia(sheet) {
  const colA = sheet.getRange("A1:A500").getValues();
  for (let i = 1; i < colA.length; i++) {
    if (!colA[i][0] || String(colA[i][0]).trim() === "") {
      return i + 1; // Linha 1-indexed
    }
  }
  return colA.length + 1;
}

function aplicarDropdownsEFormatacaoNaAba(sheet, totalLinhas = 200) {
  sheet.getRange(1, 1, 1, CABECALHOS.length).setValues([CABECALHOS]);
  const headerRange = sheet.getRange(1, 1, 1, CABECALHOS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#111827");
  headerRange.setFontColor("#ffffff");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  const larguras = [110, 135, 215, 125, 155, 185, 130, 165, 250, 220];
  larguras.forEach((largura, i) => sheet.setColumnWidth(i + 1, largura));

  sheet.getRange(2, 1, totalLinhas, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(2, 7, totalLinhas, 1).setNumberFormat("R$ #,##0.00");

  // Fórmulas automáticas para Coluna B (Dia da Semana) e Coluna C (Semana Dom-Sáb)
  const formulaDia = '=IF(ISBLANK(A2); ""; CHOOSE(WEEKDAY(A2; 1); "Domingo"; "Segunda-feira"; "Terça-feira"; "Quarta-feira"; "Quinta-feira"; "Sexta-feira"; "Sábado"))';
  const formulaSemana = '=IF(ISBLANK(A2); ""; "Semana " & (INT((A2 - DATE(YEAR(A2); 1; 1) + WEEKDAY(DATE(YEAR(A2); 1; 1); 1) - 1) / 7) + 1) & " (" & TEXT(MAX(DATE(YEAR(A2); 1; 1); A2 - WEEKDAY(A2; 1) + 1); "dd/mm") & " a " & TEXT(MIN(DATE(YEAR(A2); 12; 31); A2 + (7 - WEEKDAY(A2; 1))); "dd/mm") & ")")';
  sheet.getRange("B2").setFormula(formulaDia);
  sheet.getRange("C2").setFormula(formulaSemana);
  sheet.getRange("B2:C2").copyTo(sheet.getRange(3, 2, totalLinhas - 1, 2), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);

  const regraTipo = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Entrada", "Saída"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 4, totalLinhas, 1).setDataValidation(regraTipo);

  const regraModalidade = SpreadsheetApp.newDataValidation()
    .requireValueInList(MODALIDADES_OFICIAIS, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, totalLinhas, 1).setDataValidation(regraModalidade);

  const regraPagamento = SpreadsheetApp.newDataValidation()
    .requireValueInList(FORMAS_PAGAMENTO, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 8, totalLinhas, 1).setDataValidation(regraPagamento);

  const rangeTipo = sheet.getRange(2, 4, totalLinhas, 1);
  const rangeModalidade = sheet.getRange(2, 5, totalLinhas, 1);
  const regrasCondicionais = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Entrada")
      .setBackground("#d1fae5")
      .setFontColor("#065f46")
      .setBold(true)
      .setRanges([rangeTipo])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Saída")
      .setBackground("#fee2e2")
      .setFontColor("#991b1b")
      .setBold(true)
      .setRanges([rangeTipo])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Bonificação")
      .setBackground("#fce7f3")
      .setFontColor("#9d174d")
      .setBold(true)
      .setRanges([rangeModalidade])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Evangelismo")
      .setBackground("#dbeafe")
      .setFontColor("#1e40af")
      .setBold(true)
      .setRanges([rangeModalidade])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Gazofilácio")
      .setBackground("#fef3c7")
      .setFontColor("#78350f")
      .setBold(true)
      .setRanges([rangeModalidade])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Propósito")
      .setBackground("#f5d0fe")
      .setFontColor("#86198f")
      .setBold(true)
      .setRanges([rangeModalidade])
      .build()
  ];

  sheet.setConditionalFormatRules(regrasCondicionais);
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

  if (inicioSemana.getFullYear() < ano) {
    inicioSemana = new Date(ano, 0, 1);
  }
  if (fimSemana.getFullYear() > ano) {
    fimSemana = new Date(ano, 11, 31);
  }

  const formatarCurto = (d) =>
    String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");

  return `Semana ${numeroSemana} (${formatarCurto(inicioSemana)} a ${formatarCurto(fimSemana)})`;
}

function obterOuCriarAbaMensal(ss, dateObj) {
  const nomeAba = `${MESES_NOMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  let sheet = ss.getSheetByName(nomeAba);

  if (!sheet) {
    sheet = ss.insertSheet(nomeAba, 0);
    aplicarDropdownsEFormatacaoNaAba(sheet, 200);
  }

  return sheet;
}

function obterPastaComprovantes() {
  if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== "") {
    return DriveApp.getFolderById(DRIVE_FOLDER_ID.trim());
  }
  const nomePasta = "Comprovantes - Evangelismo";
  const pastas = DriveApp.getFoldersByName(nomePasta);
  if (pastas.hasNext()) {
    return pastas.next();
  }
  return DriveApp.createFolder(nomePasta);
}

/**
 * GET: Retorna todos os lançamentos da planilha para o Dashboard
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    const transacoes = [];
    const abasMensais = [];

    const regexAbaMensal = /^(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+\d{4}$/i;

    sheets.forEach((sheet) => {
      const nomeAba = sheet.getName();
      if (!regexAbaMensal.test(nomeAba) && sheets.length > 1) return;

      abasMensais.push(nomeAba);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      const dados = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
      dados.forEach((row, idx) => {
        if (!row[0] && !row[6]) return;

        let dataISO = "";
        let dataBR = "";
        if (row[0] instanceof Date) {
          const d = row[0];
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dataISO = `${yyyy}-${mm}-${dd}`;
          dataBR = `${dd}/${mm}/${yyyy}`;
        } else {
          const str = String(row[0]).trim();
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            const [dd, mm, yyyy] = str.split("/");
            dataISO = `${yyyy}-${mm}-${dd}`;
            dataBR = str;
          } else {
            dataISO = str;
            dataBR = str;
          }
        }

        let valorNum = 0;
        if (typeof row[6] === "number") {
          valorNum = row[6];
        } else if (row[6]) {
          valorNum = parseFloat(
            String(row[6])
              .replace(/[R$\s.]/g, "")
              .replace(",", ".")
          ) || 0;
        }

        transacoes.push({
          id: `${nomeAba}_L${idx + 2}`,
          aba: nomeAba,
          linha: idx + 2,
          data: dataISO,
          dataBR: dataBR,
          diaSemana: String(row[1] || ""),
          semana: String(row[2] || ""),
          tipo: String(row[3] || "Entrada"),
          modalidade: String(row[4] || ""),
          subitem: String(row[5] || ""),
          valor: valorNum,
          formaPagamento: String(row[7] || ""),
          descricao: String(row[8] || ""),
          comprovanteUrl: String(row[9] || "")
        });
      });
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        sucesso: true,
        planilha: ss.getName(),
        abas: abasMensais,
        transacoes: transacoes
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        sucesso: false,
        erro: err.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST: Cria novo lançamento na primeira linha vazia OU atualiza uma linha existente
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (payload.acao === "atualizarLinha" && payload.aba && payload.linha) {
      const sheet = ss.getSheetByName(payload.aba);
      if (!sheet) throw new Error("Aba não encontrada: " + payload.aba);
      if (payload.tipo) sheet.getRange(Number(payload.linha), 4).setValue(payload.tipo);
      if (payload.modalidade) sheet.getRange(Number(payload.linha), 5).setValue(payload.modalidade);
      if (payload.formaPagamento) sheet.getRange(Number(payload.linha), 8).setValue(payload.formaPagamento);

      return ContentService.createTextOutput(
        JSON.stringify({ sucesso: true, mensagem: "Linha atualizada na planilha!" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const [yyyy, mm, dd] = String(payload.data).split("-").map(Number);
    const dataObj = new Date(yyyy, mm - 1, dd);
    const semanaOficial = calcularSemanaOficial(dataObj);

    let linkComprovante = payload.comprovanteUrl || "";

    if (payload.arquivoBase64 && payload.arquivoNome) {
      const pasta = obterPastaComprovantes();
      const mimeType = payload.arquivoMimeType || "application/octet-stream";
      const bytes = Utilities.base64Decode(payload.arquivoBase64);
      const nomeArquivo = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}_${payload.modalidade}_${payload.arquivoNome}`;
      const blob = Utilities.newBlob(bytes, mimeType, nomeArquivo);
      const arquivo = pasta.createFile(blob);
      arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      linkComprovante = arquivo.getUrl();
    }

    const sheet = obterOuCriarAbaMensal(ss, dataObj);
    const valorNum = Number(payload.valor) || 0;
    const targetRow = encontrarProximaLinhaVazia(sheet);

    // Preenche Coluna A (Data) e Colunas D até J (mantendo as fórmulas automáticas em B e C!)
    sheet.getRange(targetRow, 1).setValue(dataObj);
    sheet.getRange(targetRow, 4, 1, 7).setValues([[
      payload.tipo || "Entrada",
      payload.modalidade || "Evangelismo",
      payload.subitem || "",
      valorNum,
      payload.formaPagamento || "PIX",
      payload.descricao || "",
      linkComprovante
    ]]);
    sheet.getRange(targetRow, 7).setNumberFormat("R$ #,##0.00");

    return ContentService.createTextOutput(
      JSON.stringify({
        sucesso: true,
        mensagem: `Lançamento salvo na aba "${sheet.getName()}" (Linha ${targetRow})!`,
        aba: sheet.getName(),
        linha: targetRow,
        semana: semanaOficial,
        comprovanteUrl: linkComprovante
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        sucesso: false,
        erro: err.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
