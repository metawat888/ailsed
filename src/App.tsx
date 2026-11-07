/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface PageItem {
  id?: string;
  label: string;
  icon: string;
  url?: string;
}

// ============================================================================
// 🟢 พื้นที่ตั้งค่าเมนูและหน้าเว็บ (เพิ่ม/ลบ/แก้ไข หน้าเว็บทั้งหมดได้ที่นี่จุดเดียว!) 🟢
// วิธีเพิ่มคลังข้อมูลหรือหน้าใหม่:
// เพียงคัดลอกบล็อก { label: '...', icon: '...', url: '...' } ไปวางต่อท้าย
// (ต่อให้ก๊อปปี้มาแล้วลืมแก้ id หรือไม่ใส่ id ระบบก็แยกปุ่มและหน้าเว็บให้อัตโนมัติ 100%)
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
    icon: 'fa-solid fa-school',
    url: 'https://bingo-five-rust.vercel.app/',
  },
    {
    id: 'archive',
    label: 'ห้องเรียน',
    icon: 'fa-solid fa-school',
    url: 'https://180iqmath.vercel.app/',
  },
  // 👇 ตัวอย่างการเพิ่มปุ่มใหม่ (ก๊อปปี้ไปวางต่อท้ายได้เลย ไม่ต้องกลัวชื่อ id ซ้ำ):
  // {
  //   label: 'คลังข้อมูล 2',
  //   icon: 'fa-solid fa-folder-open',
  //   url: 'https://ใส่ลิงก์เว็บของคุณที่นี่.vercel.app/',
  // },
];
// ============================================================================
// 🔴 สิ้นสุดพื้นที่ตั้งค่าเมนู (โค้ดด้านล่างทำงานอัตโนมัติ ไม่ต้องแก้ไข) 🔴
// ============================================================================

// สร้างรหัสประจำปุ่มที่ไม่ซ้ำกันแน่นอน แม้ผู้ใช้จะก๊อปปี้ id เดิมมาวางซ้ำ
const NORMALIZED_PAGES = PAGES_CONFIG.map((item, index) => ({
  ...item,
  index,
  uniqueId: item.id && !PAGES_CONFIG.slice(0, index).some((p) => p.id === item.id)
    ? item.id
    : `${item.id || 'page'}-${index + 1}`,
}));

declare global {
  interface Window {
    navigateTo?: (
      target: number | string,
      event?: React.MouseEvent | MouseEvent | null
    ) => void;
  }
}

export default function App() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [visibleIndex, setVisibleIndex] = useState<number>(0);
  const [loadedIframes, setLoadedIframes] = useState<Record<number, boolean>>({});
  const [iframeLoadedDone, setIframeLoadedDone] = useState<Record<number, boolean>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const navLinksRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndexRef = useRef<number>(0);
  const suppressNextClickRef = useRef<boolean>(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // คำนวณตำแหน่ง X ของวงแหวนไฟวิเศษให้ตรงกึ่งกลางปุ่มเสมอ
  const getLinkTargetTranslateX = useCallback((targetLink: HTMLElement | null): number => {
    if (!targetLink) return 0;
    const indicatorWidth = 60;
    const indicatorBaseLeft = 6;
    return (
      targetLink.offsetLeft +
      (targetLink.offsetWidth - indicatorWidth) / 2 -
      indicatorBaseLeft
    );
  }, []);

  // เลื่อนวงแหวนไฟวิเศษไปยังปุ่มเป้าหมายพร้อมเลื่อนแถบเมนูอัตโนมัติหากปุ่มล้นจอ
  const moveIndicator = useCallback(
    (targetLink: HTMLElement | null, instant = false) => {
      const indicator = indicatorRef.current;
      const bottomNav = bottomNavRef.current;
      if (!targetLink || !indicator) return;

      const targetX = getLinkTargetTranslateX(targetLink);
      indicator.style.transition = instant
        ? 'none'
        : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
      indicator.style.transform = `translate3d(${targetX}px, 0, 0)`;

      // เลื่อน scroll แถบเมนูด้านล่างให้เห็นปุ่มที่เลือกอย่างสมบูรณ์เมื่อมีหลายปุ่ม
      if (bottomNav && bottomNav.scrollWidth > bottomNav.clientWidth) {
        const navCenter = bottomNav.clientWidth / 2;
        const linkCenter = targetLink.offsetLeft + targetLink.offsetWidth / 2;
        bottomNav.scrollTo({
          left: Math.max(0, linkCenter - navCenter),
          behavior: instant ? 'auto' : 'smooth',
        });
      }
    },
    [getLinkTargetTranslateX]
  );

  // ฟังก์ชันเปลี่ยนหน้า (รองรับทั้งลำดับปุ่ม index และชื่อ uniqueId)
  const navigateTo = useCallback(
    (target: number | string, event: React.MouseEvent | MouseEvent | null = null) => {
      if (event) {
        event.preventDefault();
      }

      let targetIdx = -1;
      if (typeof target === 'number') {
        targetIdx = target;
      } else {
        targetIdx = NORMALIZED_PAGES.findIndex(
          (p) => p.uniqueId === target || p.id === target
        );
      }

      if (targetIdx < 0 || targetIdx >= NORMALIZED_PAGES.length) return;
      const targetPage = NORMALIZED_PAGES[targetIdx];

      // โหลด Iframe อัตโนมัติเมื่อเปิดหน้านั้นครั้งแรก
      if (targetPage.url) {
        setLoadedIframes((prev) =>
          prev[targetIdx] ? prev : { ...prev, [targetIdx]: true }
        );
      }

      setActiveIndex(targetIdx);
      activeIndexRef.current = targetIdx;

      // อัปเดต URL Hash โดยไม่ทำให้หน้ากระตุก
      if (window.history.replaceState) {
        const newHash =
          targetIdx === 0 ? window.location.pathname : `#${targetPage.uniqueId}`;
        window.history.replaceState(null, '', newHash);
      }

      requestAnimationFrame(() => {
        setVisibleIndex(targetIdx);
      });

      const targetLink = navLinksRef.current[targetIdx];
      if (targetLink) {
        moveIndicator(targetLink, false);
      }
    },
    [moveIndicator]
  );

  // เปิดให้เรียกใช้ window.navigateTo ได้จากภายนอก
  useEffect(() => {
    window.navigateTo = navigateTo;
    return () => {
      delete window.navigateTo;
    };
  }, [navigateTo]);

  // ตั้งค่าหน้าเริ่มต้นเมื่อโหลดเว็บ และรองรับ URL Hash
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    const matchedIdx = NORMALIZED_PAGES.findIndex(
      (p) => p.uniqueId === hash || p.id === hash
    );
    const initialIdx = matchedIdx >= 0 ? matchedIdx : 0;
    const initialPage = NORMALIZED_PAGES[initialIdx];

    if (initialPage?.url) {
      setLoadedIframes((prev) => ({ ...prev, [initialIdx]: true }));
    }

    setActiveIndex(initialIdx);
    activeIndexRef.current = initialIdx;

    const timer = window.setTimeout(() => {
      setVisibleIndex(initialIdx);
      const activeLink = navLinksRef.current[initialIdx];
      if (activeLink) {
        moveIndicator(activeLink, true);
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [moveIndicator]);

  // จัดตำแหน่งวงแหวนไฟวิเศษใหม่อัตโนมัติเมื่อขนาดหน้าจอเปลี่ยนหรือจำนวนปุ่มเปลี่ยน
  useEffect(() => {
    const syncIndicator = () => {
      const link = navLinksRef.current[activeIndexRef.current];
      if (link) {
        moveIndicator(link, true);
      }
    };
    syncIndicator();
    window.addEventListener('resize', syncIndicator);
    return () => window.removeEventListener('resize', syncIndicator);
  }, [activeIndex, moveIndicator]);

  // ระบบลากวงแหวนไฟวิเศษ (แก้ไขปัญหาลากข้ามปุ่มไม่สุด และป้องกันการชนกับการคลิกปกติ)
  useEffect(() => {
    const bottomNav = bottomNavRef.current;
    const indicatorElement = indicatorRef.current;
    if (!bottomNav || !indicatorElement) return;

    let isPointerDownOnIndicator = false;
    let hasDragged = false;
    let dragStartX = 0;
    let startScrollLeft = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    let dragRAF: number | null = null;

    const getBounds = () => {
      const firstLink = navLinksRef.current[0];
      const lastLink = navLinksRef.current[NORMALIZED_PAGES.length - 1];
      const minX = firstLink ? getLinkTargetTranslateX(firstLink) : 0;
      const maxX = lastLink ? getLinkTargetTranslateX(lastLink) : 0;
      return { minX, maxX };
    };

    const handleDragStart = (clientX: number, clientY: number) => {
      const rect = indicatorElement.getBoundingClientRect();
      // ตรวจสอบว่าเริ่มกดลงบนบริเวณวงแหวนไฟวิเศษ
      if (
        clientX >= rect.left - 4 &&
        clientX <= rect.right + 4 &&
        clientY >= rect.top - 4 &&
        clientY <= rect.bottom + 4
      ) {
        isPointerDownOnIndicator = true;
        hasDragged = false;
        dragStartX = clientX;
        startScrollLeft = bottomNav.scrollLeft;
        const currentLink = navLinksRef.current[activeIndexRef.current];
        startTranslate = getLinkTargetTranslateX(currentLink);
        currentTranslate = startTranslate;
      }
    };

    const handleDragMove = (clientX: number, e: TouchEvent | MouseEvent) => {
      if (!isPointerDownOnIndicator) return;

      const deltaX = clientX - dragStartX;
      // เริ่มโหมดลากเมื่อขยับเมาส์หรือนิ้วเกิน 5px เพื่อไม่ให้กวนการคลิกปุ่มปกติ
      if (!hasDragged && Math.abs(deltaX) < 5) {
        return;
      }

      hasDragged = true;
      if (e.cancelable) e.preventDefault();

      const { minX, maxX } = getBounds();
      const scrollDelta = bottomNav.scrollLeft - startScrollLeft;
      let nextTranslate = startTranslate + deltaX + scrollDelta;

      if (nextTranslate < minX) nextTranslate = minX;
      if (nextTranslate > maxX) nextTranslate = maxX;
      currentTranslate = nextTranslate;

      if (dragRAF) cancelAnimationFrame(dragRAF);
      dragRAF = requestAnimationFrame(() => {
        indicatorElement.style.transition = 'none';
        indicatorElement.style.transform = `translate3d(${nextTranslate}px, 0, 0)`;
      });
    };

    const handleDragEnd = () => {
      if (!isPointerDownOnIndicator) return;
      isPointerDownOnIndicator = false;
      if (dragRAF) cancelAnimationFrame(dragRAF);

      // ถ้าไม่ได้ลาก (แค่คลิกเฉยๆ) ให้ปล่อยให้ onClick ของปุ่มทำงานตามปกติ
      if (!hasDragged) {
        return;
      }

      hasDragged = false;
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 80);

      // หาปุ่มที่อยู่ใกล้ตำแหน่งที่ลากไปปล่อยมากที่สุดด้วยพิกัดภายในแถบเมนูโดยตรง
      let closestIdx = activeIndexRef.current;
      let minDistance = Infinity;

      NORMALIZED_PAGES.forEach((_, idx) => {
        const link = navLinksRef.current[idx];
        if (!link) return;
        const targetX = getLinkTargetTranslateX(link);
        const distance = Math.abs(targetX - currentTranslate);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      navigateTo(closestIdx);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e);
      }
    };
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
  }, [getLinkTargetTranslateX, navigateTo]);

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
          className={`page-section ${activeIndex === 0 ? 'active' : ''} ${
            visibleIndex === 0 ? 'visible' : ''
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
        {NORMALIZED_PAGES.map((page) => {
          if (!page.url || page.index === 0) return null;
          const isLoaded = Boolean(loadedIframes[page.index]);
          const isDone = Boolean(iframeLoadedDone[page.index]);

          return (
            <section
              key={page.uniqueId}
              id={page.uniqueId}
              aria-label={page.label}
              className={`page-section ${activeIndex === page.index ? 'active' : ''} ${
                visibleIndex === page.index ? 'visible' : ''
              } w-full h-dvh flex-col relative z-10 p-0 m-0 flex-grow bg-slate-950`}
            >
              {isLoaded && !isDone && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-0 pointer-events-none">
                  <div className="w-10 h-10 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
                </div>
              )}
              <iframe
                id={`iframe-${page.uniqueId}`}
                src={isLoaded ? page.url : 'about:blank'}
                data-src={page.url}
                title={page.label}
                onLoad={() => {
                  if (isLoaded) {
                    setIframeLoadedDone((prev) => ({ ...prev, [page.index]: true }));
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

          {NORMALIZED_PAGES.map((item) => {
            const isActive = activeIndex === item.index;
            return (
              <a
                key={item.uniqueId}
                href={`#${item.uniqueId}`}
                ref={(el) => {
                  navLinksRef.current[item.index] = el;
                }}
                draggable={false}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  if (suppressNextClickRef.current) {
                    e.preventDefault();
                    return;
                  }
                  navigateTo(item.index, e);
                }}
                className={`nav-link select-none relative z-10 snap-start shrink-0 flex flex-col items-center justify-center w-[60px] h-[60px] px-0.5 rounded-full group bg-transparent transition-all duration-300 ease-out active:scale-90 overflow-hidden ${
                  isActive ? 'active-menu-item text-white' : 'text-slate-400'
                }`}
              >
                <i
                  className={`${item.icon} text-[20px] mb-1 group-hover:-translate-y-0.5 transition-transform duration-300 pointer-events-none`}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium tracking-tight leading-none whitespace-nowrap max-w-[56px] truncate pointer-events-none">
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
