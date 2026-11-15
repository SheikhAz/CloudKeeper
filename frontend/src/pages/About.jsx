import { useEffect, useRef, useState } from 'react';
import '../styles/about.css'; /* adjust the path to where you keep about.css */

const FEATURES = [
  'Personal user accounts with authentication.',
  'Cloud-based photo and document storage.',
  'Upload and delete functionality.',
  'A visually distinctive frontend with a modern, creative design.',
  'A custom isometric grid built using TypeScript.',
];

const STACK = [
  ['Frontend', 'React.js, TypeScript'],
  ['Backend', 'Python, Django'],
  ['Cloud Storage', 'Cloudinary'],
  ['Authentication', 'Django-based user authentication'],
];

export default function About() {
  const root = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => document.body.classList.remove('allow-scroll');
  }, []);

  /* fade blocks in as they scroll into view */
  useEffect(() => {
    const els = root.current?.querySelectorAll('.ab-reveal') ?? [];
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    setReady(true);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main ref={root} className={`page-about ab${ready ? ' is-ready' : ''}`}>
      <div className="ab-wrap">

        {/* ---------- About Me ---------- */}
        <header className="ab-hero">
          <p className="ab-eyebrow ab-reveal">About Me</p>
          <h1 className="ab-title ab-reveal">
            Hey! I’m Sheikh <em>Azmatulla</em>
          </h1>
          <div className="ab-lead">
            <p className="ab-reveal">
              A Computer Science Engineering student specializing in Artificial
              Intelligence and Machine Learning, currently pursuing my 7th
              semester in Chhattisgarh, India.
            </p>
            <p className="ab-reveal">
              I’m from Korba, Chhattisgarh. I’m passionate about programming,
              exploring new technologies, and solving real-world problems
              through code. I enjoy turning ideas into practical applications
              and continuously experimenting with different ways to build
              better software.
            </p>
            <p className="ab-reveal">
              Beyond coding, I’m a gaming enthusiast. I enjoy playing Clash of
              Clans, FIFA Mobile, and open-world games. I love the strategy,
              creativity, exploration, and challenges that make these games
              interesting.
            </p>
          </div>
        </header>

        {/* ---------- What I Do ---------- */}
        <section className="ab-row ab-reveal">
          <h2 className="ab-label"><span className="ab-num">01</span>What I Do</h2>
          <div className="ab-body">
            <p>
              I enjoy working on full-stack development, particularly with
              Python, Django, React, and modern web technologies. I like
              understanding how things work behind the scenes, designing user
              interfaces, building backend systems, and connecting everything
              into a functional application.
            </p>
            <p>
              I also actively explore AI-assisted development tools to improve
              my workflow, experiment with creative designs, and reduce
              development time.
            </p>
          </div>
        </section>

        {/* ---------- Featured Project ---------- */}
        <section className="ab-row ab-reveal">
          <h2 className="ab-label"><span className="ab-num">02</span>Featured Project</h2>
          <div className="ab-body">
            <h3 className="ab-project">CloudKeeper</h3>
            <p className="ab-sub">
              A personal cloud-based photo and document storage platform that
              I have successfully completed.
            </p>
            <p>
              The idea came from a simple everyday problem: we often have
              important photos in our phone galleries, but when we need them
              the most, finding them becomes difficult.
            </p>
            <p>
              I wanted to build something that makes storing, organizing, and
              accessing important memories and documents easier.
            </p>
            <p>
              CloudKeeper allows users to create personal accounts, sign up,
              log in, and upload their important photos and documents to
              Cloudinary cloud storage.
            </p>

            <h4 className="ab-h4">What makes CloudKeeper interesting?</h4>
            <ul className="ab-list">
              {FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>

            <h4 className="ab-h4">Technology Stack</h4>
            <dl className="ab-stack">
              {STACK.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>

            <p>
              I developed the backend architecture and handled the integration
              between the frontend and backend. For frontend development, I
              used AI-assisted tools to explore design ideas and implement the
              visual experience I wanted. I also used AI assistance to create
              the custom isometric grid using TypeScript.
            </p>
            <p>
              After connecting both sides, I used AI-assisted coding to speed
              up parts of backend implementation while remaining involved in
              the technical decisions, integration, and problem-solving.
            </p>
          </div>
        </section>

        {/* ---------- My Philosophy ---------- */}
        <section className="ab-row ab-reveal">
          <h2 className="ab-label"><span className="ab-num">03</span>My Philosophy</h2>
          <div className="ab-body">
            <p>
              I believe coding is more than learning programming languages.
              It’s about identifying problems, thinking of solutions, and
              having the ability to turn those solutions into reality.
            </p>
            <p>
              I’m always interested in learning something new, experimenting
              with ideas, and building projects that solve actual problems.
            </p>
            <p className="ab-closing">
              <span>Keep exploring.</span>
              <span>Keep experimenting.</span>
              <span>Keep <em>building.</em></span>
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}