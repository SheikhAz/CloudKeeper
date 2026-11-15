import { useEffect, useState } from 'react';
import { getStorage, connectStorage, disconnectStorage } from '../lib/photos.js';

export default function Connect({ navigate }) {
  const [status, setStatus] = useState(null);
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStorage().then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  const connect = async () => {
    setBusy(true); setError('');
    try {
      setStatus(await connectStorage(cloudName.trim(), apiKey.trim(), apiSecret.trim()));
      setApiSecret('');
      navigate('/upload');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const disconnect = async () => {
    await disconnectStorage();
    setStatus({ connected: false });
  };

  if (!status) return <main className="upload-page" />;

  return (
    <main className="upload-page">
      <div className="upload-card">
        <h1 className="upload-title">Your storage</h1>

        {status.connected ? (
          <>
            <p className="upload-sub">Connected to Cloudinary: {status.cloud_name}</p>
            <div className="upload-actions">
              <button className="upload-btn ghost" onClick={disconnect}>Disconnect</button>
              <button className="upload-btn solid" onClick={() => navigate('/upload')}>Add a photo</button>
            </div>
          </>
        ) : (
          <>
            <p className="upload-sub">Photos are stored in your own free Cloudinary account.</p>
            <input className="connect-input" placeholder="Cloud name" value={cloudName}
                   onChange={(e) => setCloudName(e.target.value)} autoComplete="off" />
            <input className="connect-input" placeholder="API key" value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
            <input className="connect-input" placeholder="API secret" type="password" value={apiSecret}
                   onChange={(e) => setApiSecret(e.target.value)} autoComplete="off" />
            <p className="upload-error">{error}</p>
            <div className="upload-actions">
              <button className="upload-btn solid" onClick={connect}
                      disabled={busy || !cloudName || !apiKey || !apiSecret}>
                {busy ? 'Checking…' : 'Connect'}
              </button>
            </div>
            <ol className="connect-help">
              <li>Sign up free at cloudinary.com and open the Console.</li>
              <li>Go to Settings → API Keys.</li>
              <li>Copy the Cloud name, API key and API secret into the boxes above.</li>
              <li>The secret is encrypted on our server and never shown again.</li>
            </ol>
          </>
        )}
      </div>
    </main>
  );
}