/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface PageItem {
  id: string;
  label: string;
  icon: string;
  url?: string;
}

// ============================================================================
// 🟢 พื้นที่ตั้งค่าเมนูและหน้าเว็บ (เพิ่ม/ลบ/แก้ไข หน้าเว็บทั้งหมดได้ที่นี่จุดเดียว!) 🟢
// วิธีเพิ่มคลังข้อมูลหรือหน้าใหม่:
// เพียงคัดลอก 1 บล็อกด้านล่างไปวางต่อท้าย แล้วแก้ id, label, icon และ url
// ระบบจะสร้างทั้ง "หน้าต่างแสดงเว็บ (Iframe)" และ "ปุ่มเมนูด้านล่าง" ให้อัตโนมัติทันที!
// ============================================================================
const PAGES_CONFIG: PageItem[] = [
  {
    id: 'home',
    label: 'หน้าแรก',
    icon: 'fa-solid fa-house',
  },
  {
    id: 'ailab',
    label: 'Ai Lab',
    icon: 'fa-solid fa-flask',
    url: 'https://ailabv2.vercel.app/',
  },
  {
    id: 'archive',
    label: 'คลังข้อมูล',
    icon: 'fa-solid fa-database',
    url: 'https://bingo-five-rust.vercel.app/',
  },
  // 👇 ตัวอย่างการเพิ่มหน้าใหม่ (คัดลอกบรรทัดด้านล่างนี้ไปวางต่อท้ายได้เลย):
  // {
  //   id: 'archive2',
  //   label: 'คลังข้อมูล 2',
  //   icon: 'fa-solid fa-folder-open',
  //   url: 'https://ใส่ลิงก์เว็บของคุณที่นี่.vercel.app/',
  // },
];
// ============================================================================
// 🔴 สิ้นสุดพื้นที่ตั้งค่าเมนู (โค้ดด้านล่างทำงานอัตโนมัติ ไม่ต้องแก้ไข) 🔴
// ============================================================================

declare global {
  interface Window {
    navigateTo?: (pageId: string, event?: React.MouseEvent | MouseEvent | null) => void;
  }
}

export default function App() {
  const defaultPageId = PAGES_CONFIG[0]?.id || 'home';
  const [activePage, setActivePage] = useState<string>(defaultPageId);
  const [visiblePage, setVisiblePage] = useState<string>(defaultPageId);
  const [loadedIframes, setLoadedIframes] = useState<Record<string, boolean>>({});
  const [iframeLoadedDone, setIframeLoadedDone] = useState<Record<string, boolean>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const navLinksRef = useRef<Record<string, HTMLAnchorElement | null>>({});
  const transitionTimeoutRef = useRef<number | null>(null);

  // Move Magic Indicator to active button
  const moveIndicator = useCallback((targetLink: HTMLElement | null, instant = false) => {
    const indicator = indicatorRef.current;
    if (!targetLink || !indicator) return;
    const offsetLeft = targetLink.offsetLeft;
    indicator.style.transition = instant
      ? 'none'
      : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    indicator.style.transform = `translate3d(${offsetLeft - 6}px, 0, 0)`;
  }, []);

  // Navigation handler
  const navigateTo = useCallback(
    (pageId: string, event: React.MouseEvent | MouseEvent | null = null) => {
      if (event) {
        event.preventDefault();
      }

      const targetPage = PAGES_CONFIG.find((p) => p.id === pageId);
      if (!targetPage) return;

      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }

      // Lazy-load iframe automatically when navigated to for the first time
      if (targetPage.url) {
        setLoadedIframes((prev) => (prev[pageId] ? prev : { ...prev, [pageId]: true }));
      }

      setActivePage(pageId);

      // Update URL hash without scrolling
      if (window.history.replaceState) {
        const newHash = pageId === defaultPageId ? window.location.pathname : `#${pageId}`;
        window.history.replaceState(null, '', newHash);
      }

      // Trigger smooth opacity & translateY transition
      requestAnimationFrame(() => {
        setVisiblePage(pageId);
      });

      const targetLink = navLinksRef.current[pageId];
      if (targetLink) {
        moveIndicator(targetLink, false);
      }
    },
    [defaultPageId, moveIndicator]
  );

  // Expose navigateTo globally
  useEffect(() => {
    window.navigateTo = navigateTo;
    return () => {
      delete window.navigateTo;
    };
  }, [navigateTo]);

  // Initial page setup & URL hash support
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const matchedPage = PAGES_CONFIG.find((p) => p.id === hash);
    const initialPage = matchedPage ? matchedPage.id : defaultPageId;

    if (matchedPage?.url) {
      setLoadedIframes((prev) => ({ ...prev, [initialPage]: true }));
    }

    setActivePage(initialPage);
    const timer = window.setTimeout(() => {
      setVisiblePage(initialPage);
      const activeLink = navLinksRef.current[initialPage];
      if (activeLink) {
        moveIndicator(activeLink, true);
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [defaultPageId, moveIndicator]);

  // Keep Magic Indicator aligned on window resize
  useEffect(() => {
    const handleResizeIndicator = () => {
      const link = navLinksRef.current[activePage];
      if (link) {
        moveIndicator(link, true);
      }
    };
    window.addEventListener('resize', handleResizeIndicator);
    return () => window.removeEventListener('resize', handleResizeIndicator);
  }, [activePage, moveIndicator]);

  // Magic Indicator Drag Logic (Touch & Mouse)
  useEffect(() => {
    const bottomNav = bottomNavRef.current;
    const indicatorElement = indicatorRef.current;
    if (!bottomNav || !indicatorElement) return;

    let isDraggingIndicator = false;
    let dragStartX = 0;
    let currentTranslate = 0;
    let dragRAF: number | null = null;

    const getTranslateX = () => {
      const transform = window.getComputedStyle(indicatorElement).transform;
      if (transform && transform !== 'none') {
        const matrix = transform.match(/^matrix\((.+)\)$/);
        if (matrix) return parseFloat(matrix[1].split(', ')[4]);
        const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
        if (matrix3d) return parseFloat(matrix3d[1].split(', ')[12]);
      }
      return 0;
    };

    const handleDragStart = (clientX: number, clientY: number) => {
      const rect = indicatorElement.getBoundingClientRect();
      if (
        clientX >= rect.left - 10 &&
        clientX <= rect.right + 10 &&
        clientY >= rect.top - 10 &&
        clientY <= rect.bottom + 10
      ) {
        isDraggingIndicator = true;
        dragStartX = clientX;
        currentTranslate = getTranslateX();
        if (dragRAF) cancelAnimationFrame(dragRAF);
        indicatorElement.style.transition = 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)';
      }
    };

    const handleDragMove = (clientX: number, e: TouchEvent | MouseEvent) => {
      if (!isDraggingIndicator) return;
      if (e.cancelable) e.preventDefault();
      let newTranslate = currentTranslate + (clientX - dragStartX);
      const maxScroll = bottomNav.scrollWidth - 72;

      if (newTranslate < 0) newTranslate = 0;
      if (newTranslate > maxScroll) newTranslate = maxScroll;

      if (dragRAF) cancelAnimationFrame(dragRAF);
      dragRAF = requestAnimationFrame(() => {
        indicatorElement.style.transition = 'none';
        indicatorElement.style.transform = `translate3d(${newTranslate}px, 0, 0)`;
      });
    };

    const handleDragEnd = () => {
      if (!isDraggingIndicator) return;
      isDraggingIndicator = false;
      if (dragRAF) cancelAnimationFrame(dragRAF);

      const indicatorRect = indicatorElement.getBoundingClientRect();
      const indicatorCenter = indicatorRect.left + indicatorRect.width / 2;

      let closestPageId: string | null = null;
      let minDistance = Infinity;

      PAGES_CONFIG.forEach(({ id }) => {
        const link = navLinksRef.current[id];
        if (!link) return;
        const rect = link.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const distance = Math.abs(center - indicatorCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestPageId = id;
        }
      });

      if (closestPageId) {
        navigateTo(closestPageId);
      } else {
        const currentLink = navLinksRef.current[activePage];
        if (currentLink) moveIndicator(currentLink);
      }
    };

    const onTouchStart = (e: TouchEvent) =>
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX, e);
    const onMouseDown = (e: MouseEvent) => handleDragStart(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e);

    bottomNav.addEventListener('touchstart', onTouchStart, { passive: true });
    bottomNav.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);

    bottomNav.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleDragEnd);

    return () => {
      if (dragRAF) cancelAnimationFrame(dragRAF);
      bottomNav.removeEventListener('touchstart', onTouchStart);
      bottomNav.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);

      bottomNav.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [activePage, moveIndicator, navigateTo]);

  // Interactive Particle Background Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const mouse: { x: number | null; y: number | null; radius: number } = {
      x: null,
      y: null,
      radius: width < 768 ? 100 : 180,
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.8;
        this.speedY = (Math.random() - 0.5) * 0.8;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }

      draw() {
        ctx!.fillStyle = '#334155'; // Slate-700
        ctx!.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
      }
    }

    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      const numberOfParticles = Math.min((width * height) / 12000, 100);
      for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle());
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      mouse.radius = width < 768 ? 100 : 180;
      initParticles();
    };

    let resizeTimeout: number;
    const handleResize = () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(resize, 200);
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        mouse.x = event.touches[0].clientX;
        mouse.y = event.touches[0].clientY;
      }
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const animateParticles = () => {
      ctx.fillStyle = '#020617'; // Slate 950 (Dark mode background)
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;

          if (Math.abs(dx) < 150 && Math.abs(dy) < 150) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 150) {
              ctx.beginPath();
              ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - distance / 150) * 0.25})`;
              ctx.lineWidth = 0.5;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }

        if (mouse.x != null && mouse.y != null) {
          const dx = particles[i].x - mouse.x;
          const dy = particles[i].y - mouse.y;
          if (Math.abs(dx) < mouse.radius && Math.abs(dy) < mouse.radius) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius) {
              ctx.beginPath();
              ctx.strokeStyle = `rgba(249, 115, 22, ${(1 - distance / mouse.radius) * 0.4})`;
              ctx.lineWidth = 1;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(animateParticles);
    };

    resize();
    animateParticles();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseout', handleMouseOut, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseOut, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseOut);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col text-slate-200 relative z-0">
      {/* Interactive Background Canvas */}
      <canvas
        id="particle-canvas"
        ref={canvasRef}
        aria-hidden="true"
        className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none"
      />

      <main className="flex-grow relative z-10 w-full flex flex-col">
        {/* SECTION 1: Home */}
        <section
          id="home"
          aria-label="หน้าแรก ห้องเรียนครูอาร์ม"
          className={`page-section ${activePage === 'home' ? 'active' : ''} ${
            visiblePage === 'home' ? 'visible' : ''
          } border-b border-slate-800/80 relative z-10 w-full min-h-dvh pb-[100px] overflow-hidden m-0 flex-col items-center justify-center`}
        >
          <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-12 lg:px-20 py-10 md:py-16 flex flex-col-reverse md:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="flex-1 text-center md:text-left space-y-4 md:space-y-5">
              <div className="mb-4 flex justify-center md:justify-start start-opacity-0 animate-fade-in-up">
                <div className="p-2 bg-slate-900/80 border border-slate-700/60 rounded-2xl backdrop-blur-md shadow-xl inline-block hover:scale-105 transition-transform duration-300">
                  <img
                    src="https://live.staticflickr.com/65535/55608910330_91be335ec1.jpg"
                    alt="AILSED Logo"
                    width="64"
                    height="64"
                    loading="eager"
                    className="h-12 sm:h-14 md:h-16 w-auto object-contain rounded-xl"
                  />
                </div>
              </div>
              <h2 className="font-inter text-[#0ea5e9] font-bold tracking-widest uppercase text-xs md:text-sm mb-1 start-opacity-0 animate-slide-in-left anim-delay-100 drop-shadow-md">
                <i className="fa-solid fa-sparkles mr-2" aria-hidden="true"></i> Inspiring the Future
              </h2>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight md:leading-loose drop-shadow-lg start-opacity-0 animate-fade-in-up anim-delay-200 py-2 md:py-3">
                ยินดีต้อนรับสู่ <br className="block md:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0ea5e9] to-[#3b82f6] font-black italic tracking-wide inline-block hover:scale-105 transition-transform duration-300 cursor-default px-1 py-1 md:px-2 md:py-3 md:ml-3">
                  ห้องเรียนครูอาร์ม
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 font-medium py-1 md:py-2 start-opacity-0 animate-fade-in-up anim-delay-300 leading-relaxed md:leading-loose drop-shadow">
                พื้นที่รวบรวม{' '}
                <span className="text-[#f97316] font-bold underline decoration-[#f97316]/40 decoration-4 underline-offset-4 hover:text-[#ea580c] transition-colors cursor-default">
                  นวัตกรรม
                </span>{' '}
                และ{' '}
                <span className="text-[#0ea5e9] font-bold underline decoration-[#0ea5e9]/40 decoration-4 underline-offset-4 hover:text-[#0284c7] transition-colors cursor-default">
                  ไอเดียการเรียนรู้
                </span>
              </p>
              <p className="font-inter text-sm md:text-base text-slate-400 leading-loose max-w-2xl mx-auto md:mx-0 border-l-4 border-[#0ea5e9] pl-4 py-3 md:pl-5 md:py-4 bg-slate-900/60 rounded-r-xl shadow-lg backdrop-blur-md start-opacity-0 animate-fade-in-up anim-delay-400 hover:border-l-8 hover:bg-slate-800/80 transition-all duration-300 border border-transparent hover:border-slate-700/50">
                ผมมีความตั้งใจในการพัฒนาสื่อการสอนเทคโนโลยี{' '}
                <span className="font-semibold text-white">AI Solutions</span>{' '}
                และสร้างสรรค์สถาปัตยกรรมซอฟต์แวร์ใหม่ๆ ที่จะช่วยเปลี่ยนห้องเรียนธรรมดา
                ให้กลายเป็นพื้นที่แห่งการเรียนรู้ที่สนุกและตอบโจทย์อนาคต
              </p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center start-opacity-0 animate-fade-in-up anim-delay-500 w-full">
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 hover:scale-105 transition-transform duration-500">
                <img
                  src="https://live.staticflickr.com/65535/55605088814_c19d528e89_c.jpg"
                  alt="ครูวิทยาศาสตร์ในห้องเรียนอัจฉริยะ"
                  width="320"
                  height="320"
                  loading="eager"
                  className="w-full h-full object-cover object-top rounded-full shadow-2xl border-4 border-slate-800 relative z-10"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0ea5e9]/40 to-[#f97316]/30 blur-2xl -z-10 animate-pulse"></div>
              </div>
              <div className="mt-6 md:mt-8 text-center bg-slate-900/80 px-5 md:px-6 py-3 rounded-2xl backdrop-blur-xl border border-slate-700/80 shadow-2xl hover:shadow-blue-500/10 transition-shadow w-fit mx-auto">
                <h3 className="font-inter text-base sm:text-lg md:text-xl font-bold text-white tracking-wide whitespace-nowrap">
                  Mr. Metawat Phongsaphang
                </h3>
                <p className="font-inter text-[10px] sm:text-xs md:text-sm font-bold mt-1 uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#0ea5e9] to-[#f97316] whitespace-nowrap">
                  Senior Professional Level Teacher
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* AUTO-GENERATED IFRAME SECTIONS FROM PAGES_CONFIG */}
        {PAGES_CONFIG.filter((page) => Boolean(page.url)).map((page) => {
          const isLoaded = Boolean(loadedIframes[page.id]);
          const isDone = Boolean(iframeLoadedDone[page.id]);

          return (
            <section
              key={page.id}
              id={page.id}
              aria-label={page.label}
              className={`page-section ${activePage === page.id ? 'active' : ''} ${
                visiblePage === page.id ? 'visible' : ''
              } w-full h-dvh flex-col relative z-10 p-0 m-0 flex-grow bg-slate-950`}
            >
              {isLoaded && !isDone && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-0 pointer-events-none">
                  <div className="w-10 h-10 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
                </div>
              )}
              <iframe
                id={`iframe-${page.id}`}
                src={isLoaded ? page.url : 'about:blank'}
                data-src={page.url}
                title={page.label}
                onLoad={() => {
                  if (isLoaded) {
                    setIframeLoadedDone((prev) => ({ ...prev, [page.id]: true }));
                  }
                }}
                className="w-full h-full border-0 relative z-10"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </section>
          );
        })}
      </main>

      {/* Bottom Navigation Bar (Auto-Generated from PAGES_CONFIG) */}
      <div className="fixed bottom-4 sm:bottom-6 left-0 w-full z-[999] pb-safe px-4 pointer-events-none flex justify-center">
        <nav
          id="bottom-nav"
          ref={bottomNavRef}
          aria-label="เมนูหลัก"
          className="relative bg-zinc-900/85 backdrop-blur-[24px] border border-slate-600/30 rounded-full shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] p-1.5 flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide touch-pan-x snap-x snap-mandatory pointer-events-auto max-w-full w-auto gap-1 select-none"
        >
          {/* ไฟวิเศษที่วิ่งตามปุ่ม */}
          <div id="magic-indicator" ref={indicatorRef} className="magic-indicator" />

          {PAGES_CONFIG.map((item) => {
            const isActive = activePage === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                ref={(el) => {
                  navLinksRef.current[item.id] = el;
                }}
                draggable={false}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => navigateTo(item.id, e)}
                className={`nav-link select-none relative z-10 snap-start shrink-0 flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full group bg-transparent transition-all duration-300 ease-out active:scale-90 ${
                  isActive ? 'active-menu-item text-white' : 'text-slate-400'
                }`}
              >
                <i
                  className={`${item.icon} text-[20px] mb-1 group-hover:-translate-y-0.5 transition-transform duration-300 pointer-events-none`}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium tracking-wide pointer-events-none">
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
