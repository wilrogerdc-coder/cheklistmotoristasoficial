
import { AppSettings, LogEntry, Vehicle, Station, User } from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const sheetsService = {
  async ensureSpreadsheet(accessToken: string, settings: AppSettings): Promise<string> {
    if (settings.googleSpreadsheetId) {
      // Small check if it exists
      try {
        const res = await fetch(`${SHEETS_API_BASE}/${settings.googleSpreadsheetId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) return settings.googleSpreadsheetId;
      } catch (e) {
        console.warn("Spreadsheet ID in settings looks invalid, creating new one.");
      }
    }

    // Create new spreadsheet
    const res = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: `CheckViatura Pro - Data Storage (${new Date().toLocaleDateString()})` },
        sheets: [
          { properties: { title: 'CONFIGURACOES' } },
          { properties: { title: 'VIATURAS' } },
          { properties: { title: 'POSTOS' } },
          { properties: { title: 'CONFERENTES' } },
          { properties: { title: 'CHECKLISTS' } }
        ]
      })
    });

    if (!res.ok) throw new Error('Failed to create spreadsheet');
    const data = await res.json();
    return data.spreadsheetId;
  },

  async syncSettings(accessToken: string, spreadsheetId: string, settings: AppSettings) {
    const values = [
      ['CHAVE', 'VALOR'],
      ['Titulo Cabecalho', settings.headerTitle || ''],
      ['Cor Cabecalho', settings.headerBgColor || ''],
      ['Logo 1', settings.headerLogoUrl1 || ''],
      ['Logo 2', settings.headerLogoUrl2 || ''],
      ['Escala Impressao', settings.printScale || 1],
      ['Marca Dagua', settings.watermarkUrl || ''],
      ['Ultima Sincronizacao', new Date().toISOString()]
    ];

    await updateSheet(accessToken, spreadsheetId, 'CONFIGURACOES!A1:B10', values);
  },

  async syncVehicles(accessToken: string, spreadsheetId: string, vehicles: Vehicle[]) {
    const values = [
      ['ID', 'PREFIXO', 'PLACA', 'TIPO', 'POSTO', 'GB'],
      ...vehicles.map(v => [v.id, v.prefix, v.plate, v.type, v.station || '', v.gb || ''])
    ];
    await updateSheet(accessToken, spreadsheetId, 'VIATURAS!A1:F' + (vehicles.length + 1), values);
  },

  async syncStations(accessToken: string, spreadsheetId: string, stations: Station[]) {
    const values = [
      ['ID', 'NOME', 'SGB_ID'],
      ...stations.map(s => [s.id, s.name, s.sgbId || ''])
    ];
    await updateSheet(accessToken, spreadsheetId, 'POSTOS!A1:C' + (stations.length + 1), values);
  },

  async syncUsers(accessToken: string, spreadsheetId: string, users: User[]) {
    const values = [
      ['ID', 'NOME', 'USUARIO', 'RE'],
      ...users.map(u => [u.id, u.name || '', u.username, u.rank || ''])
    ];
    await updateSheet(accessToken, spreadsheetId, 'CONFERENTES!A1:D' + (users.length + 1), values);
  },

  async appendLog(accessToken: string, spreadsheetId: string, log: LogEntry) {
    const values = [[
      log.date,
      log.prefix,
      log.plate,
      log.checklistType,
      log.km,
      log.vehicleStatus || '',
      log.inspector || '',
      log.id
    ]];
    
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/CHECKLISTS!A1:H1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
  }
};

async function updateSheet(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  // Clear first might be better for full syncs
  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range.split('!')[0]}!A1:Z1000:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Sheets API Error:', error);
    throw new Error('Failed to update sheet ' + range);
  }
}
