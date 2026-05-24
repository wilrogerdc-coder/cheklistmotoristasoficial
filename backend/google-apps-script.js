
/**
 * GOOGLE APPS SCRIPT - BACKEND CHECKVIATURA PRO v4.1
 * Sistema de Auditoria, Sincronização de Dados e Gestão de Acessos.
 * IMPORTANTE: Configure o acesso como "Qualquer pessoa" (Anyone).
 */

function doPost(e) {
  var result = { "result": "error", "message": "Início do processamento" };
  try {
    var contents = e.postData && e.postData.contents;
    if (!contents) {
      // Tenta buscar nos parâmetros caso tenha sido enviado como form data
      if (e.parameter && e.parameter.data) {
        contents = e.parameter.data;
      } else {
        throw new Error("Corpo da requisição vazio ou malformado");
      }
    }
    
    var data = JSON.parse(contents);
    var action = data.action;

    if (action === "saveLog") {
      return saveInspectionLog(data);
    } else if (action === "saveUser") {
      return saveUser(data);
    } else if (action === "deleteUser") {
      return deleteUser(data);
    } else {
      result.message = "Ação desconhecida: " + action;
    }
  } catch (error) {
    result.message = "Erro no doPost: " + error.toString();
    console.error(result.message);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    // Log para depuração
    console.log("GET Parâmetros: " + JSON.stringify(e.parameter));
    
    var action = e.parameter.action;
    
    // Fallback caso action esteja em parameters (como array)
    if (!action && e.parameters && e.parameters.action) {
      action = e.parameters.action[0];
    }
    
    if (action === "getLogs") {
      return fetchInspectionLogs(e);
    }
    if (action === "getUsers") {
      return fetchUsers();
    }
    if (action === "test") {
      return ContentService.createTextOutput(JSON.stringify({ 
        "result": "success", 
        "message": "Conexão estabelecida com sucesso!", 
        "timestamp": new Date().toISOString(),
        "database": SpreadsheetApp.getActiveSpreadsheet().getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "result": "error", 
      "message": "Ação GET inválida ou não informada: " + (action || "vazia"),
      "debug": {
        "receivedAction": action,
        "allParameters": e.parameter
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Erro no doGet: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      "result": "error", 
      "message": "Erro interno no servidor: " + error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveUser(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    
    if (!sheet) {
      sheet = ss.insertSheet("Users");
      sheet.appendRow(["Username", "Password", "CreatedAt"]);
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    var username = String(data.username || "").trim();
    var password = String(data.password || "").trim();

    if (!username || !password) {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Dados incompletos" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Proteção Superusuário
    if (username.toUpperCase() === "CAVALIERI") {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Mestre Inalterável" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var usersData = sheet.getDataRange().getValues();
    var rowIndex = -1;
    
    for (var i = 1; i < usersData.length; i++) {
      if (usersData[i][0] && usersData[i][0].toString().toLowerCase() === username.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 2).setValue(password);
    } else {
      sheet.appendRow([username, password, new Date().toISOString()]);
    }

    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteUser(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Planilha Users não encontrada" })).setMimeType(ContentService.MimeType.JSON);

    var username = String(data.username || "").trim();
    if (username.toUpperCase() === "CAVALIERI") return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Não é possível excluir o mestre" })).setMimeType(ContentService.MimeType.JSON);

    var usersData = sheet.getDataRange().getValues();
    for (var i = 1; i < usersData.length; i++) {
      if (usersData[i][0] && usersData[i][0].toString().toLowerCase() === username.toLowerCase()) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchUsers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

    var data = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        users.push({
          username: data[i][0],
          password: data[i][1],
          createdAt: data[i][2]
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify(users))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveInspectionLog(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
    
    if (sheet.getLastRow() === 0) {
      var headers = ["ID", "Data", "Viatura", "Placa", "Periodicidade", "KM", "Conferente", "Resumo Status", "Detalhes Itens JSON", "Espelho Fiel JSON", "Observações", "Foto da Conferência"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    var rowId = data.id || Utilities.getUuid();
    sheet.appendRow([
      rowId,
      data.date || "",
      data.prefix || "",
      data.plate || "",
      data.checklistType || "",
      data.km || 0,
      data.inspector || "NÃO IDENTIFICADO",
      data.itemsStatus || "",
      data.itemsDetail || "[]",
      data.fullData || "{}",
      data.generalObservation || "",
      data.screenshot || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": rowId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchInspectionLogs(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Logs");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

    var dataRange = sheet.getDataRange();
    var data = dataRange.getValues();
    if (data.length <= 1) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    
    var headers = data[0];
    var rows = data.slice(1);

    // Filtros opcionais via URL
    var filterPrefix = e && e.parameter.prefix ? e.parameter.prefix.toLowerCase().trim() : null;
    var filterMonth = e && e.parameter.month ? e.parameter.month.trim() : null; // Formato YYYY-MM

    var logs = [];
    // Processar de trás para frente para pegar os mais recentes primeiro
    for (var i = rows.length - 1; i >= 0; i--) {
      var row = rows[i];
      var obj = {};
      
      headers.forEach(function(header, j) {
        var h = header.toString().trim();
        var key = "";
        
        if (h === "ID") key = "id";
        else if (h === "Data") key = "date";
        else if (h === "Viatura") key = "prefix";
        else if (h === "Placa") key = "plate";
        else if (h === "Periodicidade") key = "checklistType";
        else if (h === "KM") key = "km";
        else if (h === "Conferente") key = "inspector";
        else if (h === "Resumo Status") key = "itemsStatus";
        else if (h === "Detalhes Itens JSON") key = "itemsDetail";
        else if (h === "Espelho Fiel JSON") key = "fullData";
        else if (h === "Observações") key = "generalObservation";
        else if (h === "Foto da Conferência") key = "screenshot";
        else key = h.toLowerCase().replace(/\s+/g, '_');
        
        obj[key] = row[j];
      });

      // Normalização da data para filtragem por mês
      var logDateStr = obj.date ? obj.date.toString() : "";
      var logMonth = "";
      
      if (logDateStr.includes('-') && logDateStr.indexOf('-') === 4) {
        // Formato YYYY-MM-DD
        logMonth = logDateStr.substring(0, 7);
      } else if (logDateStr.includes('/')) {
        // Formato DD/MM/YYYY
        var parts = logDateStr.split('/');
        if (parts.length >= 3) {
          var year = parts[2].split(' ')[0];
          var month = parts[1].padStart(2, '0');
          logMonth = year + "-" + month;
        }
      }

      // Aplicar filtros no servidor
      var matchesPrefix = !filterPrefix || (obj.prefix && obj.prefix.toString().toLowerCase().indexOf(filterPrefix) !== -1);
      var matchesMonth = !filterMonth || (logMonth === filterMonth);

      if (matchesPrefix && matchesMonth) {
        logs.push(obj);
      }

      // Limite de segurança para não estourar memória/tempo de execução
      if (logs.length >= 1000) break;
    }

    return ContentService.createTextOutput(JSON.stringify(logs))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    console.error("Erro fetchInspectionLogs: " + e.toString());
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
}
