import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/lightbox.css';

const SWIPE_MIN = 60;
const lbWarmed = new Set();
const full = (url) => url.replace('c_fill,w_560,h_720,q_auto,f_auto', 'c_limit,w_1600,q_auto,f_auto');

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export default function Lightbox({ photos, index, onChange, onClose }) {
  const count = photos.length;
  const [dir, setDir] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const moved = useRef(false);
  const openedAt = useRef(performance.now());

  /* lock page scroll while open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const go = useCallback((step) => {
    if (count < 2) return;
    setDir(step);
    onChange((index + step + count) % count);
  }, [index, count, onChange]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => {
    const current = photos[index]?.url;
    [1, -1].forEach((s) => {
        const p = photos[(index + s + count) % count];
        if (!p || p.url === current) return;
        const src = full(p.url);
        if (lbWarmed.has(src)) return;
        lbWarmed.add(src);
        const img = new Image();
        img.onerror = () => lbWarmed.delete(src);
        img.src = src;
    });
   }, [index, photos, count]);

  const onPointerDown = (e) => {
    if (e.target.closest('.lb-ctrl')) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onPointerMove = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      moved.current = true;
      setDragging(true);
      setDrag(dx);                       /* image follows the finger */
    }
  };
  const onPointerEnd = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    start.current = null;
    setDragging(false);
    setDrag(0);
    if (moved.current && Math.abs(dx) > SWIPE_MIN) go(dx < 0 ? 1 : -1);
  };

  const photo = photos[index];
  if (!photo) return null;

  const fade = Math.max(0.35, 1 - Math.abs(drag) / 520);

  /* portal to <body>: escapes the strip's stacking context so the blur covers everything */
  return createPortal(
    <div
      className="lb-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={() => {
        if (performance.now() - openedAt.current < 350) return; /* the tap that opened it */
        if (moved.current) return;                               /* end of a swipe */
        onClose();
      }}
    >
      {/* blurred copy of the same photo fills the whole screen */}
      <div
        key={`bg-${photo.url}`}
        className="lb-bg"
        style={{ backgroundImage: `url("${photo.url}")` }}
        aria-hidden="true"
      />

      <div
        className={`lb-stage ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateX(${drag}px)`, opacity: fade }}
      >
        <img
          key={photo.url}
          className={`lb-img ${dir > 0 ? 'from-right' : dir < 0 ? 'from-left' : ''}`}
          src={full(photo.url)}
          alt=""
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <button className="lb-ctrl lb-close" type="button" aria-label="Close"
              onClick={onClose}>
        <Icon d="M6 6l12 12M18 6L6 18" />
      </button>

      {count > 1 && (
        <>
          <button className="lb-ctrl lb-nav lb-prev" type="button" aria-label="Previous photo"
                  onClick={() => go(-1)}>
            <Icon d="M14.5 5l-7 7 7 7" />
          </button>
          <button className="lb-ctrl lb-nav lb-next" type="button" aria-label="Next photo"
                  onClick={() => go(1)}>
            <Icon d="M9.5 5l7 7-7 7" />
          </button>
          <div className="lb-ctrl lb-count" aria-live="polite">
            <b>{index + 1}</b><span>/ {count}</span>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}