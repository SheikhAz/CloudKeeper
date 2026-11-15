import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => document.body.classList.remove('allow-scroll');
  }, []);

  return (
    <main className="page-about">
      <h1 className="about-title">
        Dametreus Ward is the name, the Artist &amp; CEO of Meech213.
        Owner of MeechStudios. Based in Los Angeles and relocating
        to New York fall 2026.
      </h1>

      <figure className="about-portrait">
        <img
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1040&h=1480&fit=crop&q=80&auto=format&sat=-100"
          alt="Dametreus Ward, Artist and CEO of Meech213"
        />
      </figure>

      <div className="about-mission">
        <img
          className="about-thumb"
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=264&h=320&fit=crop&q=80&auto=format&sat=-100"
          alt=""
        />
        <p>
          My mission is to deliver high fashion/beauty artistically, while
          providing excellent personal attention and demonstrating a unique
          experience for each and every client.
        </p>
      </div>
    </main>
  );
}