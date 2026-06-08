
export const driveService = {
  async uploadFile(accessToken: string, blob: Blob, fileName: string, mimeType: string): Promise<string> {
    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Drive API Error:', error);
      throw new Error('Failed to upload file to Google Drive');
    }

    const data = await res.json();
    return data.id;
  }
};
