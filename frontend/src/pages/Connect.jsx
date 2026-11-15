import { useEffect, useState } from 'react';
import Stage, { useWide } from '../components/Stage.jsx';
import { padlock } from '../stickers/icons';
import { getStorage, connectStorage, disconnectStorage } from '../lib/photos.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const CLOUDINARY_SIGNUP_URL = 'https://cloudinary.com/users/register_free';
const CLOUDINARY_KEYS_URL = 'https://console.cloudinary.com/settings/api-keys';

/* cloudinary://API_KEY:API_SECRET@CLOUD_NAME (optionally prefixed with CLOUDINARY_URL=) */
const parseCloudinaryUrl = (v) => {
  const m = v.trim().match(/^(?:CLOUDINARY_URL=)?cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
};

const linkStyle = { color: 'red' };

export default function Connect({ navigate }) {
  const wide = useWide();
  const [status, setStatus] = useState(null);
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askDisconnect, setAskDisconnect] = useState(false);
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
    try { await disconnectStorage(); } catch {}
    setStatus({ connected: false });
    setAskDisconnect(false);
  };

  /* paste the whole CLOUDINARY_URL once and fill all three fields */
  const onPasteUrl = (e) => {
    e.preventDefault(); // the pasted text (contains the secret) never lands in this box
    const parsed = parseCloudinaryUrl(e.clipboardData.getData('text'));
    if (!parsed) {
      setError('That does not look like a Cloudinary environment variable.');
      return;
    }
    if (/^\*+$/.test(parsed.apiSecret)) {
      setError('The secret is hidden. Click the eye icon in Cloudinary, then copy again.');
      return;
    }
    setError('');
    setCloudName(parsed.cloudName);
    setApiKey(parsed.apiKey);
    setApiSecret(parsed.apiSecret);
  };

  if (!status) return <main className="upload-page" />;

  const actionsStyle = wide ? { justifyContent: 'flex-start' } : undefined;

  /* desktop: the steps sit under the padlock so the form fits above the dial */
  const help = (
    <ol className="connect-help"
        style={wide ? { margin: 0, maxWidth: 360 } : undefined}>
      <li>
        New to Cloudinary?{' '}
        <a href={CLOUDINARY_SIGNUP_URL} target="_blank" rel="noopener noreferrer"
           style={linkStyle}>
          Sign up free
        </a>.
      </li>
      <li>
        Then{' '}
        <a href={CLOUDINARY_KEYS_URL} target="_blank" rel="noopener noreferrer"
           style={linkStyle}>
          open API Keys
        </a>{' '}
        (log in if asked). If you land on the dashboard instead, go to Settings → API Keys.
      </li>
      <li>
        Copy the <b>API environment variable</b> and paste it in the first box, or copy the
        Cloud name, API key and API secret into the other three.
      </li>
      <li>The secret is encrypted on our server and never shown again.</li>
    </ol>
  );

  return (
    <Stage
      icon={padlock}
      label="Animated padlock"
      mobileArtStyle={{ width: 'min(38vw, 140px)', margin: '-28px auto -20px' }}
      mobileClass="upload-page"
      mobileInnerClass="upload-card"
      artWidth={status.connected ? undefined : 'min(24vw, 250px, 30vh)'}
      aside={status.connected ? undefined : help}
    >
      <h1 className="upload-title">Your storage</h1>

      {status.connected ? (
        <>
          <p className="upload-sub">Connected to Cloudinary: {status.cloud_name}</p>
          <div className="upload-actions" style={actionsStyle}>
            <button className="upload-btn ghost" onClick={() => setAskDisconnect(true)}>Disconnect</button>
            <button className="upload-btn solid" onClick={() => navigate('/upload')}>Add a photo</button>
          </div>
        </>
      ) : (
        <>
          <p className="upload-sub">Photos are stored in your own free Cloudinary account.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && cloudName && apiKey && apiSecret) connect();
            }}
            style={{ display: 'contents' }}   /* keeps your existing layout and spacing */
          >
            <input className="connect-input" placeholder="Paste API environment variable (fills all three)"
                  value="" readOnly onPaste={onPasteUrl} autoComplete="off" />
            <input className="connect-input" name="cloud_name" placeholder="Cloud name" value={cloudName}
                  onChange={(e) => setCloudName(e.target.value)} autoComplete="off" />
            <input className="connect-input" name="api_key" placeholder="API key" value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
            <input className="connect-input" name="api_secret" placeholder="API secret" type="password"
                  value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                  autoComplete="new-password" />
            <p className="upload-error">{error}</p>
            <div className="upload-actions" style={actionsStyle}>
              <button type="submit" className="upload-btn solid"
                      disabled={busy || !cloudName || !apiKey || !apiSecret}>
                {busy ? 'Checking…' : 'Connect'}
              </button>
            </div>
          </form>
          {!wide && help}
        </>
      )}
      <ConfirmDialog
        open={askDisconnect}
        danger
        title="Disconnect storage?"
        message="Your photos stay safe in Cloudinary, but you will need to enter your details again to upload."
        confirmLabel="Disconnect"
        onConfirm={disconnect}
        onCancel={() => setAskDisconnect(false)}
      />
    </Stage>
  );
}