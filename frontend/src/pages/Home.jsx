import { useEffect, useMemo, useState } from 'react';
import WebGLStrip from '../components/WebGLStrip.jsx';
import { Sticker } from '../stickers/Sticker';
import { brand } from '../stickers/fun';
import { camera } from '../stickers/icons';
import { readCached, fetchPhotos, preload } from '../lib/photos.js';

const Y = [30, -10, 40, 20, -20, 35, 0, 25, -15];   /* keeps the wavy look */
const MOBILE = { shiftY: 0.09 };                    /* defined once, outside the component */
const MIN_CARDS = 6;                                /* the strip is a circle, so few photos look sparse */
const PALETTE = brand('#fa0202', '#141212');        /* site red + ink, defined once so it never repaints */

function toItems(list) {
  if (!list.length) return [];
  const repeated = [];
  while (repeated.length < MIN_CARDS) repeated.push(...list);
  return repeated.map((p, i) => ({
    src: p.url, w: 300, h: 390, y: Y[i % Y.length],
  }));
}

export default function Home({ navigate }) {
  const [photos, setPhotos] = useState(() => readCached());   /* instant, from cache */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    preload(photos);
    fetchPhotos()
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* memoised: WebGLStrip rebuilds when `items` changes identity */
  const items = useMemo(() => toItems(photos), [photos]);

  return (
    <main className="strip-page">
      {items.length > 0 && (
        <WebGLStrip items={items} gap={170} drift={0.65} radiusFactor={2.2}
                    top={0.40} slope={0.4} mobile={MOBILE} />
      )}
      {items.length === 0 && loaded && (
        <section
          aria-live="polite"
          style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', cursor: 'default',
            padding: '110px 24px 150px',
          }}
        >
          <Sticker icon={camera} palette={PALETTE} enter={0.15} replayOnHover
                  label="Animated camera"
                  style={{ width: 'min(60vw, 260px)', marginBottom: 18 }} />
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 400,
            fontSize: 'clamp(32px, 8vw, 48px)', lineHeight: 1.05,
            marginBottom: 12,
          }}>
            Your strip is <em style={{ fontStyle: 'normal', color: '#fa0202' }}>empty</em>
          </h1>
          <p style={{
            maxWidth: 280, fontSize: 13, lineHeight: 1.65,
            color: 'rgba(20,18,18,.55)', marginBottom: 22,
          }}>
            Upload a photo and it will start drifting around your vault.
          </p>
          <button className="upload-btn solid" style={{ minWidth: 190, whiteSpace: 'nowrap' }}
                  onClick={() => navigate('/upload')}>
            Add your first photo
          </button>
        </section>
      )}
    </main>
  );
}