import { useEffect, useMemo, useState } from 'react';
import WebGLStrip from '../components/WebGLStrip.jsx';
import Stage, { useWide, PALETTE } from '../components/Stage.jsx';
import Upload from './Upload.jsx';
import { Sticker } from '../stickers/Sticker';
import { cloud, folder, padlock } from '../stickers/icons';
import {
  readCached, fetchPhotos, deletePhoto,
  getStorageStatus, disconnectStorage,
} from '../lib/photos.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';


const Y = [30, -10, 40, 20, -20, 35, 0, 25, -15];
const MOBILE = { shiftY: 0.09 };      /* module level so the strip isn't rebuilt */
const MIN_CARDS = 6;

/* three buttons must fit a phone: shrink instead of overflowing the card */
const BTN = { minWidth: 0, flex: '1 1 0', padding: '14px 10px', letterSpacing: '.14em' };

const TABS = [
  { id: 'strip',  label: 'Photos' },
  { id: 'remove', label: 'Remove' },
  { id: 'status', label: 'Connection' },
  { id: 'upload', label: 'Upload' },
];

/* true when the server list matches what we already have, so we skip a re-render */
const sameUrls = (a, b) =>
  a.length === b.length && a.every((p, i) => p.url === b[i].url);

function toItems(list) {
  if (!list.length) return [];
  const rep = [];
  while (rep.length < MIN_CARDS) rep.push(...list);
  return rep.map((p, i) => ({ src: p.url, w: 300, h: 390, y: Y[i % Y.length] }));
}

/* ---------- view 1: the strip ---------- */
function StripView({ items, loaded, onAdd }) {
  const wide = useWide();
  return (
    <main className="strip-page">
      {items.length > 0 && (
        <WebGLStrip items={items} gap={170} drift={0.65} radiusFactor={2.2}
                    top={0.40} slope={0.4} mobile={MOBILE} />
      )}
      {items.length === 0 && loaded && (
        <Stage
          tag="section"
          icon={cloud}
          label="Animated cloud"
          mobileStyle={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', cursor: 'default',
            padding: '150px 24px 150px',
          }}
          mobileInnerStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          mobileArtStyle={{ width: 'min(60vw, 260px, 28vh)', margin: '-24px auto -8px' }}
        >
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 400,
            fontSize: 'clamp(32px, 8vw, 52px)', lineHeight: 1.05,
            marginBottom: 12,
          }}>
            No photos <em style={{ fontStyle: 'normal', color: '#fa0202' }}>yet</em>
          </h1>
          <p style={{
            maxWidth: wide ? 380 : 280, fontSize: 13, lineHeight: 1.65,
            color: 'rgba(20,18,18,.55)', marginBottom: 22,
          }}>
            Add a photo and it will be kept safe in your vault.
          </p>
          <button className="upload-btn solid" style={{ minWidth: 190, whiteSpace: 'nowrap' }}
                  onClick={onAdd}>
            Add a photo
          </button>
        </Stage>
      )}
    </main>
  );
}

/* ---------- view 2: remove ---------- */
function RemoveView({ photos, setPhotos }) {
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [forceId, setForceId] = useState(null);   /* Cloudinary delete failed: offer "vault only" */
  const [error, setError] = useState('');

  const remove = async (id, force = false) => {
    setBusyId(id); setError('');
    try {
      await deletePhoto(id, { force });
      setPhotos((list) => list.filter((p) => p.id !== id));
      setConfirmId(null);
      setForceId(null);
    } catch (err) {
      if (err.code === 'cloud_delete_failed') {
        setConfirmId(null);
        setForceId(id);                 /* opens the second dialog below */
      } else {
        setForceId(null);
        setError(err.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="photo-panel">
      <div className="photo-panel-inner">
        {photos.length === 0 && (
          <Sticker icon={folder} palette={PALETTE} enter={0.1} replayOnHover
                   label="Animated empty folder"
                   style={{ width: 'min(52vw, 210px)', margin: '-24px auto -16px' }} />
        )}
        <h1 className="upload-title">Remove photos</h1>
        <p className="upload-sub">Removing a photo deletes it from your Cloudinary account too.</p>
        <p className="upload-error">{error}</p>

        {photos.length === 0 ? (
          <p className="upload-sub">You have no photos to remove.</p>
        ) : (
          <div className="photo-grid">
            {photos.map((p) => (
              <div className="photo-tile" key={p.id}>
                <img src={p.url} alt="" loading="lazy" />
                <div className="photo-tile-bar">
                  {confirmId === p.id ? (
                    <>
                      <button className="danger" disabled={busyId === p.id} onClick={() => remove(p.id)}>
                        {busyId === p.id ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button disabled={busyId === p.id} onClick={() => setConfirmId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmId(p.id)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={forceId !== null}
        danger
        busy={busyId !== null && busyId === forceId}
        title="Couldn't delete from Cloudinary"
        message="Remove this photo from your vault only? The file will stay in your Cloudinary account."
        confirmLabel={busyId !== null && busyId === forceId ? 'Removing…' : 'Remove from vault'}
        onConfirm={() => remove(forceId, true)}
        onCancel={() => setForceId(null)}
      />
    </main>
  );
}

/* ---------- view 3: connection status ---------- */
function StatusView({ navigate }) {
  const wide = useWide();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const check = async () => {
    setChecking(true); setError('');
    try { setS(await getStorageStatus(true)); }
    catch (e) { setError(e.message); }
    setChecking(false);
  };
  useEffect(() => { check(); }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    try { await disconnectStorage(); } catch {}
    setDisconnecting(false);
    setAskDisconnect(false);
    check();
  };

  let dot = '', text = 'Checking…';
  if (!checking && error) { dot = 'bad'; text = error; }
  else if (!checking && s) {
    if (!s.connected) { dot = 'bad'; text = 'Not connected'; }
    else if (s.ok) { dot = 'ok'; text = 'Working'; }
    else { dot = 'bad'; text = `Problem: ${s.reason || 'could not verify'}`; }
  }

  return (
    <Stage
      icon={padlock}
      label="Animated padlock"
      mobileClass="photo-panel"
      mobileInnerClass="status-card"
      mobileArtStyle={{ width: 'min(40vw, 150px)', margin: '-30px auto -22px' }}
    >
      <h1 className="upload-title">Connection</h1>
      <p className="upload-sub">Your Cloudinary storage</p>

      <div className="status-rows">
        <div className="status-row">
          <span>Status</span>
          <span><i className={`status-dot ${dot}`} />{text}</span>
        </div>
        <div className="status-row">
          <span>Account</span>
          <span>{s?.connected ? s.cloud_name : '—'}</span>
        </div>
        <div className="status-row">
          <span>Photos</span>
          <span>{s?.connected ? s.photos : '—'}</span>
        </div>
      </div>

      <div className="upload-actions" style={{ flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : undefined }}>
        {s?.connected ? (
          <>
            <button className="upload-btn ghost" style={BTN} onClick={check} disabled={checking}>Re-check</button>
            <button className="upload-btn solid" style={BTN} onClick={() => setAskDisconnect(true)}>Disconnect</button>
          </>
        ) : (
          <button className="upload-btn solid" onClick={() => navigate('/connect')}>Connect</button>
        )}
      </div>

      <ConfirmDialog
        open={askDisconnect}
        danger
        busy={disconnecting}
        title="Disconnect storage?"
        message="Your photos stay safe in Cloudinary, but you will need to enter your details again to upload."
        confirmLabel={disconnecting ? 'Disconnecting…' : 'Disconnect'}
        onConfirm={disconnect}
        onCancel={() => setAskDisconnect(false)}
      />
    </Stage>
  );
}

/* ---------- the page ---------- */
export default function Photo({ navigate }) {
  const [view, setView] = useState('strip');
  const [photos, setPhotos] = useState(() => readCached());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPhotos()   /* already warms the browser cache via preload() */
      .then((fresh) => setPhotos((prev) => (sameUrls(prev, fresh) ? prev : fresh)))
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => toItems(photos), [photos]);

  return (
    <>
      <nav className="photo-tabs" aria-label="Photo options">
        {TABS.map((t) => (
          <button key={t.id} className={view === t.id ? 'is-active' : ''} onClick={() => setView(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {view === 'strip' && (
        <StripView items={items} loaded={loaded} onAdd={() => setView('upload')} />
      )}
      {view === 'upload' && (
        <Upload
          navigate={navigate}
          embedded
          onDone={() => { setPhotos(readCached()); setView('strip'); }}
          onCancel={() => setView('strip')}
        />
      )}
      {view === 'remove' && <RemoveView photos={photos} setPhotos={setPhotos} />}
      {view === 'status' && <StatusView navigate={navigate} />}
    </>
  );
}