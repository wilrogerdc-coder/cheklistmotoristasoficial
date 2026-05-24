/**
 * CheckViatura Pro - Google Apps Script Backend
 * Este script processa as gravações de logs e a sincronização do banco de dados.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheet = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Online' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Salvar Log de Conferência
    if (action === 'saveLog') {
      let logSheet = sheet.getSheetByName('LOGS');
      if (!logSheet) {
        logSheet = sheet.insertSheet('LOGS');
        logSheet.appendRow(['DATA', 'PREFIXO', 'PLACA', 'TIPO', 'KM', 'STATUS', 'CONFERENTE', 'RESUMO ITENS', 'ID PROTOCOLO', 'DADOS COMPLETOS']);
      }
      
      logSheet.appendRow([
        data.date,
        data.prefix,
        data.plate,
        data.checklistType,
        data.km,
        data.vehicleStatus,
        data.inspector,
        data.itemsStatus,
        data.id,
        data.fullData
      ]);

      return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Sincronizar Entidades (Viaturas, Postos, Usuários)
    if (action === 'syncEntities') {
      const vehicles = JSON.parse(data.vehicles || '[]');
      const stations = JSON.parse(data.stations || '[]');
      const users = JSON.parse(data.users || '[]');
      
      // Sincronizar Viaturas
      let vSheet = sheet.getSheetByName('VIATURAS');
      if (!vSheet) vSheet = sheet.insertSheet('VIATURAS');
      vSheet.clear();
      vSheet.appendRow(['ID', 'PREFIXO', 'PLACA', 'TIPO', 'POSTO']);
      vehicles.forEach(v => vSheet.appendRow([v.id, v.prefix, v.plate, v.type, v.station || '']));

      // Sincronizar Postos
      let sSheet = sheet.getSheetByName('POSTOS');
      if (!sSheet) sSheet = sheet.insertSheet('POSTOS');
      sSheet.clear();
      sSheet.appendRow(['ID', 'NOME', 'SGB_ID']);
      stations.forEach(s => sSheet.appendRow([s.id, s.name, s.sgbId || '']));

      // Sincronizar Usuários
      let uSheet = sheet.getSheetByName('USUARIOS');
      if (!uSheet) uSheet = sheet.insertSheet('USUARIOS');
      uSheet.clear();
      uSheet.appendRow(['ID', 'NOME', 'USUARIO', 'RE', 'PERMISSOES']);
      users.forEach(u => uSheet.appendRow([u.id, u.name || '', u.username, u.rank || '', JSON.stringify(u.permissions)]));

      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Sincronização completa' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheet = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'getLogs') {
      const logSheet = sheet.getSheetByName('LOGS');
      if (!logSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = logSheet.getDataRange().getValues();
      const headers = rows[0];
      const logs = rows.slice(1).map(row => {
        let rawLog = {};
        headers.forEach((header, i) => {
          rawLog[header] = row[i];
        });
        
        // Mapear para o formato LogEntry esperado pelo frontend
        return {
          date: rawLog['DATA'],
          prefix: rawLog['PREFIXO'],
          plate: rawLog['PLACA'],
          checklistType: rawLog['TIPO'],
          km: rawLog['KM'],
          vehicleStatus: rawLog['STATUS'],
          inspector: rawLog['CONFERENTE'],
          itemsStatus: rawLog['RESUMO ITENS'],
          id: rawLog['ID PROTOCOLO'],
          fullData: rawLog['DADOS COMPLETOS']
        };
      });

      return ContentService.createTextOutput(JSON.stringify(logs))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getUsers') {
      const uSheet = sheet.getSheetByName('USUARIOS');
      if (!uSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = uSheet.getDataRange().getValues();
      const headers = rows[0];
      const users = rows.slice(1).map(row => {
        let user = {};
        headers.forEach((header, i) => {
          if (header === 'PERMISSOES') {
             try {
               user[header] = JSON.parse(row[i]);
             } catch(e) {
               user[header] = row[i];
             }
          } else {
             user[header] = row[i];
          }
        });
        // Adaptar nomes das propriedades para o frontend
        return {
          id: user.ID,
          name: user.NOME,
          username: user.USUARIO,
          rank: user.RE,
          permissions: user.PERMISSOES
        };
      });

      return ContentService.createTextOutput(JSON.stringify(users))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("CheckViatura Pro API Ativa.");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
