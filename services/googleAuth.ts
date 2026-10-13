
export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  displayName?: string;
  photoURL?: string;
}

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Verificamos se estamos em um popup de callback
  const hash = window.location.hash;
  if (hash && hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token && window.opener) {
      window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token }, '*');
      window.close();
      return;
    }
  }

  const session = localStorage.getItem('google_session');
  if (session) {
    try {
      const { user, token, expiresAt } = JSON.parse(session);
      if (Date.now() < expiresAt) {
        if (onAuthSuccess) onAuthSuccess(user, token);
        return;
      }
    } catch (e) {
      console.error("Erro ao carregar sessão Google:", e);
    }
  }
  if (onAuthFailure) onAuthFailure();
};

export const googleSignIn = async (): Promise<void> => {
  if (!CLIENT_ID || CLIENT_ID.startsWith('#') || CLIENT_ID === 'tricolor') {
    alert("ERRO DE CONFIGURAÇÃO:\n\nPara que o Login Google funcione sem Firebase, você PRECISA inserir um 'Client ID' válido no menu de Configurações (VITE_GOOGLE_CLIENT_ID).\n\nComo obter:\n1. Acesse console.cloud.google.com\n2. Crie um ID de Cliente OAuth 2.0 (Web)\n3. Adicione a URL do app nas Origens Autorizadas.");
    return;
  }

  const redirectUri = window.location.origin;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
  
  window.open(authUrl, 'google_login', 'width=500,height=600');
};

export const fetchUserProfile = async (token: string): Promise<GoogleUser> => {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Falha ao obter perfil do Google');
  return await res.json();
};

export const getAccessToken = async (): Promise<string | null> => {
  const session = localStorage.getItem('google_session');
  if (session) {
    const { token } = JSON.parse(session);
    return token;
  }
  return null;
};

export const googleLogout = async () => {
  localStorage.removeItem('google_session');
  console.log('Logout Google realizado');
};

export const saveGoogleSession = (user: GoogleUser, token: string) => {
  const session = {
    user,
    token,
    expiresAt: Date.now() + 3500 * 1000 // ~1h
  };
  localStorage.setItem('google_session', JSON.stringify(session));
};
