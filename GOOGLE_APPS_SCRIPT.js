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

    // AÇÃO: Salvar Log de Auditoria
    if (action === 'saveAuditLog') {
      let auditSheet = sheet.getSheetByName('AUDITORIA');
      if (!auditSheet) {
        auditSheet = sheet.insertSheet('AUDITORIA');
        auditSheet.appendRow(['DATA', 'USUARIO', 'ACAO', 'DETALHES', 'ID']);
      }
      
      auditSheet.appendRow([
        data.date,
        data.user,
        data.actionLog, // 'action' is reserved in doPost logic
        data.details,
        data.id
      ]);

      return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Salvar Justificativa
    if (action === 'saveJustification') {
      let jSheet = sheet.getSheetByName('JUSTIFICATIVAS');
      if (!jSheet) {
        jSheet = sheet.insertSheet('JUSTIFICATIVAS');
        jSheet.appendRow(['ID', 'DATA_REFERENCIA', 'TIPO', 'TIPO_VEICULO', 'POSTO', 'JUSTIFICATIVA', 'AUTOR', 'RE', 'CRIADO_EM', 'MES', 'STATUS']);
      }
      
      jSheet.appendRow([
        data.id,
        data.dateRef,
        data.type,
        data.vehicleType,
        data.station,
        data.justification,
        data.author,
        data.authorRank,
        data.createdAt,
        data.month,
        data.status
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
      uSheet.appendRow(['ID', 'NOME', 'USUARIO', 'SENHA', 'RE', 'PERMISSOES']);
      users.forEach(u => uSheet.appendRow([u.id, u.name || '', u.username, u.password || '', u.rank || '', JSON.stringify(u.permissions)]));

      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Sincronização completa' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Salvar/Atualizar Usuário Individual
    if (action === 'saveUser') {
      let uSheet = sheet.getSheetByName('USUARIOS');
      if (!uSheet) {
        uSheet = sheet.insertSheet('USUARIOS');
        uSheet.appendRow(['ID', 'NOME', 'USUARIO', 'SENHA', 'RE', 'PERMISSOES']);
      }
      
      const rows = uSheet.getDataRange().getValues();
      const headers = rows[0];
      const usernameIndex = headers.indexOf('USUARIO');
      
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][usernameIndex] === data.username) {
          rowIndex = i + 1;
          break;
        }
      }
      
      const userData = [
        data.id || Utilities.getUuid(),
        data.name || '',
        data.username,
        data.password || '',
        data.rank || '',
        typeof data.permissions === 'string' ? data.permissions : JSON.stringify(data.permissions || { checklist: true, reports: true, settings: true })
      ];
      
      if (rowIndex > 0) {
        uSheet.getRange(rowIndex, 1, 1, userData.length).setValues([userData]);
      } else {
        uSheet.appendRow(userData);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Excluir Usuário
    if (action === 'deleteUser') {
      let uSheet = sheet.getSheetByName('USUARIOS');
      if (!uSheet) return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
      
      const rows = uSheet.getDataRange().getValues();
      const headers = rows[0];
      const usernameIndex = headers.indexOf('USUARIO');
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][usernameIndex] === data.username) {
          uSheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
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
        let userArr = {};
        headers.forEach((header, i) => {
          userArr[header] = row[i];
        });
        
        let permissions = { checklist: true, reports: true, settings: true };
        try {
          const rawPerms = userArr['PERMISSOES'];
          if (rawPerms) {
            permissions = JSON.parse(rawPerms);
          }
        } catch(e) {}

        return {
          id: userArr['ID'],
          name: userArr['NOME'],
          username: userArr['USUARIO'],
          password: userArr['SENHA'],
          rank: userArr['RE'],
          permissions: permissions
        };
      });

      return ContentService.createTextOutput(JSON.stringify(users))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getJustifications') {
      const jSheet = sheet.getSheetByName('JUSTIFICATIVAS');
      if (!jSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = jSheet.getDataRange().getValues();
      const headers = rows[0];
      const items = rows.slice(1).map(row => {
        let item = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        return {
          id: item.ID,
          date: item.DATA_REFERENCIA,
          type: item.TIPO,
          vehicleType: item.TIPO_VEICULO,
          station: item.POSTO,
          justification: item.JUSTIFICATIVA,
          author: item.AUTOR,
          authorRank: item.RE,
          createdAt: item.CRIADO_EM,
          month: item.MES,
          status: item.STATUS
        };
      });

      return ContentService.createTextOutput(JSON.stringify(items))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getAuditLogs') {
      const auditSheet = sheet.getSheetByName('AUDITORIA');
      if (!auditSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = auditSheet.getDataRange().getValues();
      const headers = rows[0];
      const items = rows.slice(1).map(row => {
        let item = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        return {
          id: item.ID,
          date: item.DATA,
          user: item.USUARIO,
          action: item.ACAO,
          details: item.DETALHES
        };
      }).reverse(); // Most recent logs first

      return ContentService.createTextOutput(JSON.stringify(items))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("CheckViatura Pro API Ativa.");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
