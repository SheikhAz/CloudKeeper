import { useEffect, useState } from 'react';
import { Sticker } from '../stickers/Sticker';
import { brand } from '../stickers/fun';

/* one palette for every sticker, defined once so they never repaint */
export const PALETTE = brand('#fa0202', '#141212');

const QUERY = '(min-width: 901px)';

/* true on desktop widths. Mobile layouts are untouched by this file. */
export function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/*
  Desktop: sticker on the left, content on the right, kept clear of the logo/tabs
  (top) and the dial (bottom). Everything is inline, so it never depends on the stylesheet.
  Mobile: the original stacked layout, using the page's own classes/styles.
*/
export default function Stage({
  icon, label, children,
  tag: Tag = 'main',
  mobileClass, mobileStyle, mobileInnerClass, mobileInnerStyle,
  mobileArt = true, mobileArtStyle,
  aside, artWidth = 'min(32vw, 380px, 44vh)',   /* desktop only: extra content under the sticker, and its size */
}) {
  const wide = useWide();

  if (wide) {
    return (
      <Tag
        style={{
          position: 'fixed', inset: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(40px, 7vw, 120px)',
          padding: '150px 6vw clamp(210px, 30vh, 280px)',
          textAlign: 'left', cursor: 'default',
        }}
      >
        <div style={{ flex: '0 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Sticker icon={icon} palette={PALETTE} enter={0.15} replayOnHover label={label}
                   style={{ width: artWidth }} />
          {aside}
        </div>
        <div style={{ flex: '0 1 440px', minWidth: 0 }}>{children}</div>
      </Tag>
    );
  }

  return (
    <Tag className={mobileClass} style={mobileStyle}>
      <div className={mobileInnerClass} style={mobileInnerStyle}>
        {mobileArt && (
          <Sticker icon={icon} palette={PALETTE} enter={0.15} replayOnHover label={label}
                   style={mobileArtStyle} />
        )}
        {children}
      </div>
    </Tag>
  );
}