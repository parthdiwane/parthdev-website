"use client";

import { useEffect } from "react";

type ExperienceItem = {
  date: string;
  org?: string;
  orgHref?: string;
  title: string;
  titleHref?: string;
  description: string;
  badge?: string;
};

type ProjectItem = {
  number: string;
  title: string;
  href?: string;
  description: React.ReactNode;
};

const experienceItems: ExperienceItem[] = [
  {
    date: "Summer 2026",
    org: "Cisco",
    orgHref: "https://www.cisco.com/",
    title: "Software Engineering Intern",
    titleHref: "https://www.cisco.com/",
    description: "Working on switching team",
    badge: "Incoming",
  },
  {
    date: "Oct 2025 - March 2026",
    org: "Amazon",
    orgHref: "https://aws.amazon.com/ai/",
    title: "AI Researcher",
    description:
      "developed pipelines for embodied AI and multi-agent benchmarks",
  },
  {
    date: "Oct 2025 - Present",
    title: "NLP Researcher",
    titleHref: "http://nlp.cs.ucsb.edu/",
    description: "UCSB NLP Group - Advised by Xin Eric Wang",
  },
  {
    date: "Jun 2024 - Jan 2025",
    org: "Georgia Tech",
    orgHref: "https://www.gatech.edu/",
    title: "Computer Networking Researcher",
    description: "researched BGP protocol and hijacking attacks on BGP",
  },
];

const projectItems: ProjectItem[] = [
  {
    number: "01",
    title: "EmToM",
    description: (
      <>
        benchmark for multi-agent collaboration in an embodied (
        <a
          className="inline-link"
          href="https://github.com/facebookresearch/partnr-planner"
          target="_blank"
          rel="noreferrer"
        >
          Partnr
        </a>
        ) setting
      </>
    ),
  },
  {
    number: "02",
    title: "card-counter",
    href: "https://github.com/parthdiwane/card-counter",
    description: "counting cards using CV, Meta glasses, and the MiDaS model.",
  },
  {
    number: "03",
    title: "match-point",
    href: "https://github.com/parthdiwane/match-point",
    description: "predicting outcomes of tennis matches using random forests.",
  },
  {
    number: "04",
    title: "maze-agent",
    href: "https://github.com/parthdiwane/maze-agent",
    description:
      "reinforcement learning project for training an agent to navigate a maze environment.",
  },
];

export default function Home() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector<HTMLElement>(".site-header");
    const nav = document.querySelector<HTMLElement>(".top-nav");

    const syncHeaderState = () => {
      const compact = window.scrollY > 24;
      header?.setAttribute("data-compact", compact ? "true" : "false");
      nav?.setAttribute("data-compact", compact ? "true" : "false");
    };

    if (reduceMotion) {
      elements.forEach((element) => {
        element.dataset.visible = "true";
      });
      syncHeaderState();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -64px 0px",
      }
    );

    elements.forEach((element) => observer.observe(element));
    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncHeaderState);
    };
  }, []);

  return (
    <main className="site-shell">
      <header className="site-header" data-reveal>
        <nav className="top-nav" aria-label="Primary">
          <a href="#about">About</a>
          <a href="#experience">Experience</a>
          <a href="#publications">Publications</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section className="hero section-grid" id="about">
        <div data-reveal>
          <p className="eyebrow">Developer Portfolio</p>
          <h1>Parth Diwane</h1>
          <p className="hero-copy">
            I research embodied AI, multi-agent collaboration, AI agents, and
            reinforcement learning.
          </p>
        </div>

        <div className="stack" data-reveal>
          <article className="panel">
            <p className="eyebrow">Interests</p>
            <p className="interest-line">
              <span>NLP</span>
              <span className="dot">•</span>
              <span>Embodied AI</span>
              <span className="dot">•</span>
              <span>RL</span>
              <span className="dot">•</span>
              <span>LLM Risk Analysis</span>
            </p>
          </article>

          <div className="info-grid">
            <article className="panel" data-reveal>
              <p className="eyebrow">School</p>
              <p className="panel-copy">UC Santa Barbara</p>
              <p className="eyebrow spaced">Program</p>
              <p className="panel-copy">Computer Engineering</p>
            </article>

            <article className="panel" data-reveal>
              <p className="eyebrow">GPA</p>
              <p className="metric">4.0</p>
              <p className="panel-copy spaced">Dean&apos;s List</p>
              <p className="metric">X2</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="experience" data-reveal>
        <p className="eyebrow">experience</p>
        <h2 className="section-title wide">Research and industry</h2>
        <div className="timeline">
          {experienceItems.map((item) => (
            <article className="timeline-item" key={`${item.date}-${item.title}`} data-reveal>
              <div className="timeline-meta">
                <p className={item.badge ? "badge" : ""}>{item.date}</p>
                {item.org ? (
                  <a href={item.orgHref} target="_blank" rel="noreferrer" className="muted-link">
                    {item.org}
                  </a>
                ) : null}
              </div>
              <div>
                <div className="timeline-header">
                  {item.titleHref ? (
                    <a href={item.titleHref} target="_blank" rel="noreferrer" className="title-link">
                      {item.title}
                    </a>
                  ) : (
                    <h3 className="title-text">{item.title}</h3>
                  )}
                  {item.badge ? <span className="status-badge">{item.badge}</span> : null}
                </div>
                <p className="timeline-copy">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="projects" data-reveal>
        <p className="eyebrow">selected builds</p>
        <h2 className="section-title">Projects</h2>
        <div className="project-grid">
          {projectItems.map((project) => (
            <article className="panel project-card" key={project.number} data-reveal>
              <p className="card-count">{project.number}</p>
              {project.href ? (
                <h3>
                  <a href={project.href} target="_blank" rel="noreferrer" className="title-link">
                    {project.title}
                  </a>
                </h3>
              ) : (
                <h3 className="title-text">{project.title}</h3>
              )}
              <p className="project-copy">{project.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="publications" data-reveal>
        <p className="eyebrow">publications</p>
        <h2 className="section-title">Research</h2>
        <article className="publication" data-reveal>
          <div className="publication-head">
            <h3>EmToM: Embodied Agent Theory of Mind Evaluation Benchmark</h3>
            <span className="status-badge">In Progress</span>
          </div>
          <p className="timeline-copy">
            Gurusha Juneja, Dylan Lu, Saaket Agashe,{" "}
            <span className="highlight-name">Parth Diwane</span>, Xin Eric Wang
          </p>
        </article>
      </section>

      <section className="section" id="writing" data-reveal>
        <p className="eyebrow">writing</p>
        <div className="panel writing-box" data-reveal>
          <p className="panel-copy lowercase">coming soon</p>
        </div>
      </section>

      <section className="section" id="contact" data-reveal>
        <p className="eyebrow">contact</p>
        <article className="panel contact-box" data-reveal>
          <div className="contact-links">
            <a className="inline-link" href="mailto:parthdiwane@ucsb.edu">
              Email
            </a>
            <a
              className="inline-link"
              href="https://www.linkedin.com/in/parth-diwane-497793254/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="inline-link"
              href="https://github.com/parthdiwane"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
