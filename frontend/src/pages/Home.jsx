import { useCallback, useEffect, useMemo, useState } from 'react';
import WebGLStrip from '../components/WebGLStrip.jsx';
import Stage, { useWide } from '../components/Stage.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { camera } from '../stickers/icons';
import { readCached, fetchPhotos, preload } from '../lib/photos.js';

const Y = [30, -10, 40, 20, -20, 35, 0, 25, -15];
const MOBILE = { shiftY: 0.09 };
const MIN_CARDS = 6;

function toItems(list) {
  if (!list.length) return [];
  const repeated = [];
  while (repeated.length < MIN_CARDS) repeated.push(...list);
  return repeated.map((p, i) => ({
    src: p.url, w: 300, h: 390, y: Y[i % Y.length],
  }));
}

export default function Home({ navigate }) {
  const wide = useWide();
  const [photos, setPhotos] = useState(() => readCached());
  const [loaded, setLoaded] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);
  const sameUrls = (a, b) =>
  a.length === b.length && a.every((p, i) => p.url === b[i].url);
  useEffect(() => {
    fetchPhotos()
      .then((fresh) => setPhotos((prev) => (sameUrls(prev, fresh) ? prev : fresh)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const items = useMemo(() => toItems(photos), [photos]);

  /* the strip repeats photos to fill the circle, so map back to the real list */
  const handleItemClick = useCallback((itemIndex) => {
    if (!photos.length) return;
    setOpenIndex(itemIndex % photos.length);
  }, [photos.length]);

  const closeLightbox = useCallback(() => setOpenIndex(null), []);

  return (
    <main className="strip-page">
      {items.length > 0 && (
        <WebGLStrip items={items} gap={170} drift={0.65} radiusFactor={2.2}
                    top={0.40} slope={0.4} mobile={MOBILE}
                    onItemClick={handleItemClick} />
      )}
      {items.length === 0 && loaded && (
        <Stage
          tag="section"
          icon={camera}
          label="Animated camera"
          mobileStyle={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', cursor: 'default',
            padding: '110px 24px 150px',
          }}
          mobileInnerStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          mobileArtStyle={{ width: 'min(60vw, 260px)', marginBottom: 18 }}
        >
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 400,
            fontSize: 'clamp(32px, 8vw, 52px)', lineHeight: 1.05,
            marginBottom: 12,
          }}>
            Your strip is <em style={{ fontStyle: 'normal', color: '#fa0202' }}>empty</em>
          </h1>
          <p style={{
            maxWidth: wide ? 380 : 280, fontSize: 13, lineHeight: 1.65,
            color: 'rgba(20,18,18,.55)', marginBottom: 22,
          }}>
            Upload a photo and it will start drifting around your vault.
          </p>
          <button className="upload-btn solid" style={{ minWidth: 190, whiteSpace: 'nowrap' }}
                  onClick={() => navigate('/upload')}>
            Add your first photo
          </button>
        </Stage>
      )}

      {openIndex !== null && photos[openIndex] && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onChange={setOpenIndex}
          onClose={closeLightbox}
        />
      )}
    </main>
  );
}