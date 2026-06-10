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
        logSheet.appendRow(['DATA', 'PREFIXO', 'PLACA', 'TIPO', 'KM', 'STATUS', 'CONFERENTE', 'RESUMO ITENS', 'ID PROTOCOLO', 'DADOS COMPLETOS', 'LINK PDF', 'OBSERVACOES', 'DETALHE ITENS']);
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
        data.fullData,
        data.pdfUrl || '',
        data.generalObservation || '',
        data.itemsDetail || ''
      ]);

      // VINCULAÇÃO: Atualizar status e KM na ficha da viatura (Sheet VIATURAS)
      try {
        const vSheet = sheet.getSheetByName('VIATURAS');
        if (vSheet) {
          const vData = vSheet.getDataRange().getValues();
          const headers = vData[0];
          const prefixIdx = headers.indexOf('PREFIXO');
          const kmIdx = headers.indexOf('ULTIMO_KM'); // Pode precisar ser criado
          const statusIdx = headers.indexOf('STATUS'); // Pode precisar ser criado
          const idIdx = headers.indexOf('ULTIMA_CONFERENCIA_ID');
          
          let targetRow = -1;
          for (let i = 1; i < vData.length; i++) {
            if (vData[i][prefixIdx] == data.prefix) {
              targetRow = i + 1;
              break;
            }
          }
          
          if (targetRow > 0) {
            if (statusIdx >= 0) vSheet.getRange(targetRow, statusIdx + 1).setValue(data.vehicleStatus);
            if (kmIdx >= 0) vSheet.getRange(targetRow, kmIdx + 1).setValue(data.km);
            if (idIdx >= 0) vSheet.getRange(targetRow, idIdx + 1).setValue(data.id);
            else {
              // Se não existe a coluna KM ou STATUS, adicionamos no final se houver espaço ou apenas ignoramos
              // Para garantir a vinculação, vamos garantir que as colunas existam no syncEntities
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao vincular dados à viatura:", e);
      }

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

    // AÇÃO: Sincronizar Entidades (Viaturas, Postos, Usuários e Configurações)
    if (action === 'syncEntities') {
      const vehicles = JSON.parse(data.vehicles || '[]');
      const stations = JSON.parse(data.stations || '[]');
      const users = JSON.parse(data.users || '[]');
      
      // Sincronizar Configurações do Sistema
      let cfgSheet = sheet.getSheetByName('CONFIGURACOES');
      if (!cfgSheet) cfgSheet = sheet.insertSheet('CONFIGURACOES');
      if (data.settings) {
        cfgSheet.clear();
        cfgSheet.appendRow(['CHAVE', 'VALOR']);
        try {
          const settingsObj = JSON.parse(data.settings);
          const keysToSave = [
            'appName', 'appDescription', 'developedBy', 'headerTitle', 
            'headerBgColor', 'headerLogoUrl1', 'headerLogoUrl2', 
            'printScale', 'defaultItems', 'vehicleImages', 'vehicleImageRatios',
            'reportTitle', 'weeklyLevesTitle', 'weeklyMotosTitle', 'weeklyAbTitle', 'dailyMotosTitle',
            'watermarkUrl', 'documentLinks', 'stationOrder', 'dashboardCharts'
          ];
          keysToSave.forEach(function(key) {
            if (settingsObj[key] !== undefined) {
              let val = settingsObj[key];
              if (typeof val === 'object') {
                val = JSON.stringify(val);
              }
              cfgSheet.appendRow([key, val]);
            }
          });
        } catch (err) {
          // fail-safe
        }
      }

      // Sincronizar Viaturas
      let vSheet = sheet.getSheetByName('VIATURAS');
      if (!vSheet) vSheet = sheet.insertSheet('VIATURAS');
      vSheet.clear();
      vSheet.appendRow(['ID', 'PREFIXO', 'PLACA', 'TIPO', 'POSTO', 'ULTIMO_KM', 'STATUS', 'ULTIMA_CONFERENCIA_ID', 'ALERTAS']);
      vehicles.forEach(v => vSheet.appendRow([v.id, v.prefix, v.plate, v.type, v.station || '', v.km || '', v.status || 'OPERANDO', v.lastCheckId || '', JSON.stringify(v.alerts || [])]));

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
      uSheet.appendRow(['ID', 'NOME', 'USUARIO', 'SENHA', 'RE', 'PERMISSOES', 'FORCE_PASS_CHANGE']);
      users.forEach(u => uSheet.appendRow([
        u.id, 
        u.name || '', 
        u.username, 
        u.password || '', 
        u.rank || '', 
        JSON.stringify(u.permissions),
        u.shouldChangePassword ? 'SIM' : 'NAO'
      ]));

      // Sincronizar Documentos & Links
      let dSheet = sheet.getSheetByName('DOCUMENTOS');
      if (!dSheet) dSheet = sheet.insertSheet('DOCUMENTOS');
      dSheet.clear();
      dSheet.appendRow(['ID', 'NOME', 'URL', 'CATEGORIA', 'DESCRICAO', 'PARAMETROS']);
      const docs = JSON.parse(data.documents || '[]');
      docs.forEach(d => dSheet.appendRow([
        d.id,
        d.name,
        d.url,
        d.category || 'GERAL',
        d.description || '',
        d.params || ''
      ]));

      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Sincronização completa' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // AÇÃO: Salvar/Atualizar Usuário Individual
    if (action === 'saveUser') {
      let uSheet = sheet.getSheetByName('USUARIOS');
      if (!uSheet) {
        uSheet = sheet.insertSheet('USUARIOS');
        uSheet.appendRow(['ID', 'NOME', 'USUARIO', 'SENHA', 'RE', 'PERMISSOES', 'FORCE_PASS_CHANGE']);
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
        typeof data.permissions === 'string' ? data.permissions : JSON.stringify(data.permissions || { checklist: true, reports: true, settings: true }),
        data.shouldChangePassword ? 'SIM' : 'NAO'
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
          permissions: permissions,
          shouldChangePassword: userArr['FORCE_PASS_CHANGE'] === 'SIM'
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

    if (action === 'getSettings') {
      const cfgSheet = sheet.getSheetByName('CONFIGURACOES');
      if (!cfgSheet) {
        return ContentService.createTextOutput(JSON.stringify({}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows = cfgSheet.getDataRange().getValues();
      let settingsObj = {};
      rows.slice(1).forEach(function(row) {
        const key = row[0];
        let val = row[1];
        if (key) {
          if (typeof val === 'string' && (val.indexOf('[') === 0 || val.indexOf('{') === 0)) {
            try {
              val = JSON.parse(val);
            } catch(e) {}
          }
          settingsObj[key] = val;
        }
      });
      return ContentService.createTextOutput(JSON.stringify(settingsObj))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getVehicles') {
      const vSheet = sheet.getSheetByName('VIATURAS');
      if (!vSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows = vSheet.getDataRange().getValues();
      const headers = rows[0];
      const vehicles = rows.slice(1).map(function(row) {
        let item = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        let alerts = [];
        try { alerts = JSON.parse(item['ALERTAS'] || '[]'); } catch(e) {}
        return {
          id: item['ID'] || '',
          prefix: item['PREFIXO'] || '',
          plate: item['PLACA'] || '',
          type: item['TIPO'] || 'LEVE/PESADA',
          station: item['POSTO'] || '',
          km: item['ULTIMO_KM'] || '',
          status: item['STATUS'] || 'OPERANDO',
          lastCheckId: item['ULTIMA_CONFERENCIA_ID'] || '',
          alerts: alerts
        };
      });
      return ContentService.createTextOutput(JSON.stringify(vehicles))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getStations') {
      const sSheet = sheet.getSheetByName('POSTOS');
      if (!sSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows = sSheet.getDataRange().getValues();
      const headers = rows[0];
      const stations = rows.slice(1).map(function(row) {
        let item = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        return {
          id: item['ID'] || '',
          name: item['NOME'] || '',
          sgbId: item['SGB_ID'] || ''
        };
      });
      return ContentService.createTextOutput(JSON.stringify(stations))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getDocuments') {
      const dSheet = sheet.getSheetByName('DOCUMENTOS');
      if (!dSheet) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows = dSheet.getDataRange().getValues();
      const headers = rows[0];
      const docs = rows.slice(1).map(function(row) {
        let item = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        return {
          id: item['ID'] || '',
          name: item['NOME'] || '',
          url: item['URL'] || '',
          category: item['CATEGORIA'] || 'GERAL',
          description: item['DESCRICAO'] || '',
          params: item['PARAMETROS'] || ''
        };
      });
      return ContentService.createTextOutput(JSON.stringify(docs))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("CheckViatura Pro API Ativa.");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
