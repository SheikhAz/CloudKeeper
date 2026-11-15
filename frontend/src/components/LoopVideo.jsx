import { useEffect, useRef } from 'react';

const FADE = 1.4; /* seconds of overlap at the end of each loop */

export default function LoopVideo({ onReady }) {
  const a = useRef(null);
  const b = useRef(null);

  useEffect(() => {
    const vids = [a.current, b.current];
    let active = 0;
    let fading = false;
    let timer;
    const play = (v) => v.play().catch(() => {});

    play(vids[0]);
    const retry = () => { play(vids[active]); window.removeEventListener('pointerdown', retry); };
    window.addEventListener('pointerdown', retry);

    /* 5 checks a second is plenty for a 1.4s fade, and keeps the main thread free */
    const poll = setInterval(() => {
      const cur = vids[active];
      const nxt = vids[1 - active];
      const d = cur.duration;
      if (d && !fading && d - cur.currentTime <= FADE) {
        fading = true;
        nxt.currentTime = 0;
        play(nxt);
        cur.style.zIndex = 1;
        nxt.style.zIndex = 2;
        nxt.classList.add('is-on');
        timer = setTimeout(() => {
          cur.classList.remove('is-on');
          cur.pause();
          cur.currentTime = 0;
          active = 1 - active;
          fading = false;
        }, FADE * 1000 + 100);
      }
    }, 200);

    return () => {
      clearInterval(poll);
      clearTimeout(timer);
      window.removeEventListener('pointerdown', retry);
    };
  }, []);

  const sources = (
    <>
      <source src="/videos/landing-mobile.mp4" media="(max-width: 700px)" type="video/mp4" />
      <source src="/videos/landing-desktop.mp4" type="video/mp4" />
    </>
  );

  return (
    <div className="landing-media" aria-hidden="true">
      <video
        ref={a}
        className="landing-video is-on"
        muted playsInline preload="auto" disablePictureInPicture aria-hidden="true"
        onCanPlay={onReady}
      >
        {sources}
      </video>
      {/* second video only loads metadata until the first loop is nearly over */}
      <video
        ref={b}
        className="landing-video"
        muted playsInline preload="metadata" disablePictureInPicture aria-hidden="true"
      >
        {sources}
      </video>
    </div>
  );
}