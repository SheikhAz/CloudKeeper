import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Stage, { useWide, PALETTE } from '../components/Stage.jsx';
import { Sticker } from '../stickers/Sticker';
import { cloud, padlock } from '../stickers/icons';
import { uploadPhoto, getStorage } from '../lib/photos.js';

/* `embedded` = shown inside the Vault tabs: finish/cancel call back instead of navigating */
export default function Upload({ navigate, embedded = false, onDone, onCancel }) {
  const wide = useWide();
  const inputRef = useRef(null);
  const [connected, setConnected] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    getStorage().then((s) => setConnected(s.connected)).catch(() => setConnected(true));
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.');
    if (f.size > 10 * 1024 * 1024) return setError('Image must be under 10 MB.');
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const leave = () => (embedded && onCancel ? onCancel() : navigate('/'));
  const finish = () => (embedded && onDone ? onDone() : navigate('/'));
  const cancelUpload = () => abortRef.current?.abort();
  const discard = () => {                      /* drop the selected photo and go back to the picker */
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setError('');
    if (inputRef.current) inputRef.current.value = '';   /* so picking the same file again still fires onChange */
  };

  const submit = async () => {
    if (!file || busy) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(''); setProgress(0);
    try {
      await uploadPhoto(file, setProgress, ctrl.signal);
      if (wide) {
        setDone(true);                                   /* show "Uploaded" briefly, then back to normal */
        timerRef.current = setTimeout(finish, 900);
      } else {
        finish();
      }
    } catch (e) {
      if (e.code === 'aborted') { setBusy(false); setProgress(0); return; }
      if (e.code === 'no_storage') return navigate('/connect');
      setError(e.message);
      setBusy(false);
    }
  };

  /* Esc: cancel the upload, or discard the photo while reviewing */
  const overlay = wide && !!preview;
  useEffect(() => {
    if (!overlay || done) return;
    const onKey = (e) => { if (e.key === 'Escape') (busy ? cancelUpload() : discard()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, done, busy]);

  const mobile = {
    mobileClass: 'upload-page',
    mobileInnerClass: 'upload-card',
  };
  const actionsStyle = wide ? { justifyContent: 'flex-start' } : undefined;

  if (connected === null) return <main className="upload-page" />;

  if (connected === false) {
    return (
      <Stage icon={padlock} label="Animated padlock" {...mobile}
             mobileArtStyle={{ width: 'min(44vw, 170px)', margin: '-28px auto -20px' }}>
        <h1 className="upload-title">Connect storage</h1>
        <p className="upload-sub">Link your Cloudinary account before adding photos.</p>
        <div className="upload-actions" style={actionsStyle}>
          <button className="upload-btn solid" onClick={() => navigate('/connect')}>Connect</button>
        </div>
      </Stage>
    );
  }

  /* desktop: a wide, short drop zone so the whole form fits above the dial */
  const dropStyle = wide
    ? { aspectRatio: 'auto', maxHeight: 'none', height: 'clamp(130px, 20vh, 200px)', width: '100%', margin: 0 }
    : undefined;

  return (
    <Stage icon={cloud} label="Animated upload cloud" mobileArt={false} {...mobile}>
      <h1 className="upload-title">Add a photo</h1>
      <p className="upload-sub">It will appear in your Cloud Keeper strip.</p>

      <div
        className={`upload-drop ${drag ? 'is-drag' : ''} ${preview && !wide ? 'has-img' : ''}`}
        style={dropStyle}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        role="button"
        tabIndex={0}
      >
        {preview && !wide
          ? <img src={preview} alt="Preview" />
          : wide
            ? <span>Drag &amp; drop an image<br /><em>or click to browse</em></span>
            : (
              <div style={{ textAlign: 'center' }}>
                <Sticker icon={cloud} palette={PALETTE} enter={0.1} replayOnHover
                         label="Animated upload cloud"
                         style={{ width: 'min(36vw, 140px)', margin: '-20px auto -8px' }} />
                <span>Drag &amp; drop an image<br /><em>or click to browse</em></span>
              </div>
            )}
        <input ref={inputRef} type="file" accept="image/*" hidden
               onChange={(e) => pick(e.target.files[0])} />
      </div>

      {busy && !wide && <div className="upload-bar"><i style={{ width: `${progress * 100}%` }} /></div>}
      <p className="upload-error">{error}</p>

      <div className="upload-actions" style={actionsStyle}>
        <button className="upload-btn ghost" onClick={leave} disabled={busy}>Cancel</button>
        <button className="upload-btn solid" onClick={submit} disabled={!file || busy}>
          {busy ? `Uploading ${Math.round(progress * 100)}%` : 'Upload'}
        </button>
      </div>

      {overlay && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={busy ? 'Uploading photo' : 'Review photo'}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,244,241,.55)',
            WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)',
            animation: 'pageIn .3s ease both',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
            <img src={preview} alt={busy ? 'Uploading' : 'Selected photo'}
                 style={{
                   display: 'block', maxWidth: 'min(70vw, 760px)', maxHeight: '58vh',
                   objectFit: 'contain', boxShadow: '0 30px 80px -24px rgba(20,18,18,.45)',
                 }} />
            <div style={{ height: 2, background: 'rgba(20,18,18,.12)' }}>
              {busy && (
                <i style={{
                  display: 'block', height: '100%', background: '#fa0202',
                  width: `${(done ? 1 : progress) * 100}%`, transition: 'width .15s linear',
                }} />
              )}
            </div>
            <p className="upload-error" style={{ margin: 0 }}>{error}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span style={{
                fontSize: 11.5, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase',
                maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {done ? 'Uploaded'
                  : busy ? `Uploading ${Math.round(progress * 100)}%`
                  : `${file?.name} · ${(file?.size / 1048576).toFixed(1)} MB`}
              </span>
              {!done && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="upload-btn ghost" onClick={busy ? cancelUpload : discard}>Cancel</button>
                  {!busy && <button className="upload-btn solid" onClick={submit}>Upload</button>}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </Stage>
  );
}