import { memo, useCallback, useEffect, useRef, useState } from 'react';
import LoopVideo from './LoopVideo.jsx';

/* ---- edit the copy here ---- */
const TITLE = [
  { text: 'Your documents.' },
  { text: 'Your Cloudinary.' },
  { text: 'Absolute privacy.', accent: true },
];
const TEXT =
  'Your personal document vault, routed straight to your own Cloudinary account. Nothing stored on our servers. Nothing compromised.';

/* ---- timing (ms) ---- */
const START_MS = 700;   // wait after clicking Begin (lets the video settle)
const CHAR_MS = 48;     // wipe speed: ms per title character
const OVERLAP = 0.72;   // next line starts when the previous is this far through
const TEXT_MS = 1300;  // paragraph reveal duration
const END_PAD = 250;    // small pause before the buttons arrive

/* ---- schedule: one wipe per title line + one for the paragraph ----
   Only 4 elements animate in total (instead of ~70 per-character spans). */
const LINES = [];
let clock = START_MS;
TITLE.forEach((l) => {
  const dur = Array.from(l.text).length * CHAR_MS;
  LINES.push({ delay: Math.round(clock), dur });
  clock += dur * OVERLAP;
});
const PARA = { delay: Math.round(clock + 60), dur: TEXT_MS };
const END = PARA.delay + PARA.dur + END_PAD;

const sched = (s) => ({ '--delay': `${s.delay}ms`, '--dur': `${s.dur}ms` });

/* the video never needs to re-render while text is revealing */
const Background = memo(LoopVideo);

/* buttons lean toward the cursor (desktop only) */
function useMagnetic() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * 0.22}px, ${y * 0.32}px)`;
    };
    const leave = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);
  return ref;
}

const Arrow = () => (
  <svg className="landing-btn-arrow" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Landing({ onLogin, onSignup, onBegin }) {
  const t0Ref = useRef(0);
  const doneRef = useRef(false);
  const startRef = useMagnetic();
  const loginRef = useMagnetic();
  const signRef = useMagnetic();

  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [started, setStarted] = useState(false);
  const [awake, setAwake] = useState(false);
  const [done, setDone] = useState(false);

  const onReady = useCallback(() => setReady(true), []);

  /* done (or skipped): CSS drops the masks, all text is fully visible, buttons arrive */
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
  }, []);

  /* start the intro one frame after mount so the CSS transitions actually run */
  useEffect(() => {
    let a = requestAnimationFrame(() => { a = requestAnimationFrame(() => setShown(true)); });
    return () => cancelAnimationFrame(a);
  }, []);

  useEffect(() => {
    const wake = () => setAwake(true);
    const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown'];
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, wake));
  }, []);

  /* the reveal itself is pure CSS; JS only decides when the buttons appear */
  useEffect(() => {
    if (!started) return;
    t0Ref.current = performance.now();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const id = setTimeout(finish, END);
    return () => clearTimeout(id);
  }, [started, finish]);

  const start = (e) => {
    e.currentTarget.blur();
    onBegin?.();
    setStarted(true);
  };

  /* tap anywhere while it is revealing = show everything now */
  const skip = () => {
    if (!started || doneRef.current) return;
    if (performance.now() - t0Ref.current < 800) return; // ignore a double-click on Begin
    finish();
  };

  const go = (e, fn) => {
    e.currentTarget.blur();
    fn();
  };

  return (
    <div
      onClick={skip}
      className={`landing ${ready ? 'is-ready ' : ''}${shown ? 'is-in' : ''} ${started ? 'is-started' : ''} ${awake ? 'is-awake' : ''} ${done ? 'is-done' : ''}`}
    >
      <Background onReady={onReady} />

      <div className="landing-vignette" aria-hidden="true" />
      <div className="landing-scrim" aria-hidden="true" />
      <div className="landing-beam" aria-hidden="true" />

      {/* step 1 */}
      <div className="landing-start" aria-hidden={started}>
        <button
          ref={startRef}
          type="button"
          className="landing-btn landing-btn-solid"
          onClick={start}
          tabIndex={started ? -1 : 0}
        >
          <span>Begin</span><Arrow />
        </button>
      </div>

      {/* step 2 */}
      <div className="landing-ui" aria-hidden={!started}>
        <div className="landing-head">
          <h1 className="landing-title">
            {TITLE.map((l, i) => (
              <span className="line tw-line" key={i} style={sched(LINES[i])}>
                {l.accent ? <em>{l.text}</em> : l.text}
              </span>
            ))}
          </h1>
        </div>

        <div className="landing-aside landing-card">
          <p className="landing-text tw-block" style={sched(PARA)}>{TEXT}</p>

          <div className="landing-actions" aria-hidden={!done}>
            <button
              ref={loginRef}
              type="button"
              className="landing-btn landing-btn-solid"
              style={{ '--d': '0s' }}
              onClick={(e) => go(e, onLogin)}
              tabIndex={done ? 0 : -1}
            >
              <span>Log in</span><Arrow />
            </button>
            <button
              ref={signRef}
              type="button"
              className="landing-btn landing-btn-ghost"
              style={{ '--d': '.14s' }}
              onClick={(e) => go(e, onSignup)}
              tabIndex={done ? 0 : -1}
            >
              <span>Create account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}