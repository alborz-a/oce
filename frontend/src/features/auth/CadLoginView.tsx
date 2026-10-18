// [RSC-IRAN] Royal Star Construction - Interactive AutoCAD Floorplan Login View
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CadBackgroundSvg } from './CadBackgroundSvg';
import { CadFloorplanSvg } from './CadFloorplanSvg';
import './LoginPage.cad.css';

interface CadLoginViewProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  error: string;
  handleSubmit: (e: React.FormEvent) => void;
}

export function CadLoginView({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  handleSubmit,
}: CadLoginViewProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [coordText, setCoordText] = useState('185.000, 118.000, 0.000');
  const [statusPrompt, setStatusPrompt] = useState<string>(
    'فرمان: <span class="text-[#d5b368]">PLINE_DRAW</span> — برای انتخاب اجزا کادر بکشید (راست به چپ: Crossing سبز / چپ به راست: Window آبی)'
  );
  const [submitBtnHovered, setSubmitBtnHovered] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [inputsActive, setInputsActive] = useState(false);

  const floorplanSvgRef = useRef<SVGSVGElement>(null);
  const tracerRef = useRef<SVGGElement>(null);
  const logoFillsRef = useRef<SVGGElement>(null);
  const logoWordmarkRef = useRef<SVGGElement>(null);
  const submitBoxFillRef = useRef<SVGPathElement>(null);
  const selBoxRef = useRef<HTMLDivElement>(null);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update status prompt on auth state changes
  useEffect(() => {
    if (loading) {
      setStatusPrompt(
        `فرمان: <span class="text-[#d5b368]">AUTH_VERIFY</span> — بررسی دسترسی کاربر (${email})...`
      );
    } else if (error) {
      setStatusPrompt(
        `فرمان: <span class="text-[#ef4444]">AUTH_ERROR</span> — خطا: ${error}`
      );
    } else if (inputsActive) {
      setStatusPrompt(
        'فرمان: <span class="text-[#d5b368]">READY</span> — آماده ورود به پرتال مهندسی رویال استار'
      );
    }
  }, [loading, error, email, inputsActive]);

  // Stroke drawing animation
  const playDrawingAnimation = useCallback(() => {
    if (!floorplanSvgRef.current) return;
    const svg = floorplanSvgRef.current;

    // Clear previous selections
    svg.querySelectorAll('.cad-entity').forEach((el) => el.classList.remove('cad-selected'));

    const paths = svg.querySelectorAll<SVGGeometryElement>('.cad-stroke');
    const strokeItems: { el: SVGGeometryElement; len: number }[] = [];

    paths.forEach((el) => {
      let len = 320;
      try {
        if (typeof el.getTotalLength === 'function') {
          len = el.getTotalLength() || 320;
        }
      } catch {
        len = 320;
      }
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      strokeItems.push({ el, len });
    });

    if (logoFillsRef.current) logoFillsRef.current.style.opacity = '0';
    if (logoWordmarkRef.current) logoWordmarkRef.current.style.opacity = '0.2';
    if (submitBoxFillRef.current) submitBoxFillRef.current.style.opacity = '0';
    setInputsActive(false);

    const duration = 2200;
    const startTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);

      // Phase 1 (0 -> 0.72): Draw all CAD strokes
      const strokePhase = Math.min(1, p / 0.72);
      const eased = 1 - Math.pow(1 - strokePhase, 3);

      let activePt: { x: number; y: number } | null = null;
      for (let idx = 0; idx < strokeItems.length; idx++) {
        const item = strokeItems[idx];
        if (!item) continue;
        const stagger = (idx % 6) * 0.04;
        const localP = Math.max(0, Math.min(1, (eased - stagger) / (1 - stagger)));
        item.el.style.strokeDashoffset = `${item.len * (1 - localP)}`;

        if (localP > 0.02 && localP < 0.98 && typeof item.el.getPointAtLength === 'function') {
          try {
            const pt = item.el.getPointAtLength(item.len * localP);
            if (item.el.closest('#entityLogo')) {
              activePt = { x: 185 + pt.x * 0.47, y: 118 + pt.y * 0.47 };
            } else {
              activePt = { x: pt.x, y: pt.y };
            }
          } catch {}
        }
      }

      if (tracerRef.current) {
        if (activePt && strokePhase < 0.98) {
          const pt = activePt;
          tracerRef.current.style.opacity = '1';
          tracerRef.current.setAttribute(
            'transform',
            `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`
          );
        } else {
          tracerRef.current.style.opacity = '0';
        }
      }

      // Phase 2 (0.58 -> 1.0): Fade in fills and enable inputs
      const fillPhase = Math.max(0, Math.min(1, (p - 0.58) / 0.42));
      if (logoFillsRef.current) logoFillsRef.current.style.opacity = String(fillPhase);
      if (logoWordmarkRef.current)
        logoWordmarkRef.current.style.opacity = String(0.2 + 0.8 * fillPhase);
      if (submitBoxFillRef.current) submitBoxFillRef.current.style.opacity = String(fillPhase);

      if (fillPhase > 0.35) {
        setInputsActive(true);
      }

      if (p < 1) {
        animId = requestAnimationFrame(step);
      } else {
        if (tracerRef.current) tracerRef.current.style.opacity = '0';
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const cancel = playDrawingAnimation();
    return () => {
      if (cancel) cancel();
    };
  }, [playDrawingAnimation]);

  // Mouse Coordinate Tracking & Marquee Selection
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, button')) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const selBox = selBoxRef.current;
    if (selBox) {
      selBox.style.display = 'block';
      selBox.style.left = `${e.clientX}px`;
      selBox.style.top = `${e.clientY}px`;
      selBox.style.width = '0px';
      selBox.style.height = '0px';
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const cadX = ((e.clientX / window.innerWidth) * 1920).toFixed(3);
    const cadY = (((window.innerHeight - e.clientY) / window.innerHeight) * 1080).toFixed(3);
    setCoordText(`${cadX}, ${cadY}, 0.000`);

    if (!isDraggingRef.current || !selBoxRef.current) return;

    const startX = dragStartRef.current.x;
    const startY = dragStartRef.current.y;
    const curX = e.clientX;
    const curY = e.clientY;

    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    selBoxRef.current.style.left = `${left}px`;
    selBoxRef.current.style.top = `${top}px`;
    selBoxRef.current.style.width = `${width}px`;
    selBoxRef.current.style.height = `${height}px`;

    // Window (L->R blue) vs Crossing (R->L green)
    if (curX >= startX) {
      selBoxRef.current.className = 'sel-window';
    } else {
      selBoxRef.current.className = 'sel-crossing';
    }
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (selBoxRef.current) selBoxRef.current.style.display = 'none';

      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      const curX = e.clientX;
      const curY = e.clientY;
      const dx = Math.abs(curX - startX);
      const dy = Math.abs(curY - startY);

      if (dx < 5 && dy < 5) {
        if (!(e.target as HTMLElement).closest('#entityLogo')) {
          floorplanSvgRef.current
            ?.querySelectorAll('.cad-entity')
            .forEach((el) => el.classList.remove('cad-selected'));
        }
        return;
      }

      const isWindowMode = curX >= startX;
      const selRect = {
        left: Math.min(startX, curX),
        right: Math.max(startX, curX),
        top: Math.min(startY, curY),
        bottom: Math.max(startY, curY),
      };

      const svgEl = floorplanSvgRef.current;
      if (!svgEl) return;
      const svgRect = svgEl.getBoundingClientRect();
      const scaleX = svgRect.width / 370;
      const scaleY = svgRect.height / 535;

      let selectedCount = 0;
      svgEl.querySelectorAll('.cad-entity').forEach((entity) => {
        const raw = entity.getAttribute('data-bbox');
        if (!raw) return;
        const coords = raw.split(',').map(Number);
        if (coords.length < 4 || coords.some(isNaN)) return;
        const [x1, y1, x2, y2] = coords as [number, number, number, number];
        const entRect = {
          left: svgRect.left + x1 * scaleX,
          top: svgRect.top + y1 * scaleY,
          right: svgRect.left + x2 * scaleX,
          bottom: svgRect.top + y2 * scaleY,
        };

        const hit = isWindowMode
          ? entRect.left >= selRect.left &&
            entRect.right <= selRect.right &&
            entRect.top >= selRect.top &&
            entRect.bottom <= selRect.bottom
          : entRect.left <= selRect.right &&
            entRect.right >= selRect.left &&
            entRect.top <= selRect.bottom &&
            entRect.bottom >= selRect.top;

        if (hit) {
          entity.classList.add('cad-selected');
          selectedCount++;
        } else if (!e.shiftKey) {
          entity.classList.remove('cad-selected');
        }
      });

      const modeLabel = isWindowMode ? 'WINDOW (چپ به راست)' : 'CROSSING (راست به چپ)';
      setStatusPrompt(
        `فرمان: <span class="text-[#d5b368]">SELECT_${modeLabel}</span> — تعداد ${selectedCount} المان پلان انتخاب شد.`
      );
    },
    []
  );

  return (
    <div
      className="cad-login-root relative flex flex-col justify-between"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* AutoCAD Selection Marquee Box */}
      <div id="cadSelectionBox" ref={selBoxRef}></div>

      {/* Background CAD Blueprint with 4 Quadrants */}
      <CadBackgroundSvg isMobile={isMobile} />

      {/* Main Center Stage with Percentage-Locked Floorplan */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div
          id="floorplanContainer"
          className="relative w-full max-w-[370px] aspect-[370/535] max-h-[calc(100dvh-2.75rem)] bg-[#14171c]/75 backdrop-blur-[1px]"
        >
          {/* Unified AutoCAD Floorplan SVG */}
          <CadFloorplanSvg
            svgRef={floorplanSvgRef}
            tracerRef={tracerRef}
            logoFillsRef={logoFillsRef}
            logoWordmarkRef={logoWordmarkRef}
            submitBoxFillRef={submitBoxFillRef}
            onReplayDrawing={playDrawingAnimation}
            emailFocused={emailFocused}
            passFocused={passFocused}
            submitBtnHovered={submitBtnHovered}
            hasError={Boolean(error)}
          />

          {/* HTML Form Controls Strictly Overlaid onto SVG Slots */}
          <form
            id="loginForm"
            onSubmit={handleSubmit}
            autoComplete="off"
            className="absolute inset-0 pointer-events-none"
          >
            {/* Email Input Overlay */}
            <div
              id="uiSlotEmail"
              style={{
                top: '63.925%',
                left: '12.162%',
                width: '75.676%',
                height: '8.224%',
                opacity: inputsActive ? 1 : 0,
              }}
              className="absolute pointer-events-auto transition-opacity duration-300"
            >
              <input
                id="emailInput"
                type="email"
                required
                placeholder="ایمیل"
                className="cad-input-overlay"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </div>

            {/* Password Input Overlay */}
            <div
              id="uiSlotPass"
              style={{
                top: '75.140%',
                left: '12.162%',
                width: '75.676%',
                height: '8.224%',
                opacity: inputsActive ? 1 : 0,
              }}
              className="absolute pointer-events-auto transition-opacity duration-300"
            >
              <input
                id="passInput"
                type="password"
                required
                placeholder="گذرواژه"
                className="cad-input-overlay"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
            </div>

            {/* Submit Button Overlay */}
            <div
              id="uiSlotSubmit"
              style={{
                top: '86.355%',
                left: '12.162%',
                width: '75.676%',
                height: '7.477%',
                opacity: inputsActive ? 1 : 0,
              }}
              className="absolute pointer-events-auto transition-opacity duration-300"
            >
              <button
                type="submit"
                id="submitBtn"
                disabled={loading}
                onMouseEnter={() => setSubmitBtnHovered(true)}
                onMouseLeave={() => setSubmitBtnHovered(false)}
                className="w-full h-full flex items-center justify-center text-sm font-semibold tracking-wide text-[#f1f5f9] hover:text-[#d5b368] transition-colors cursor-pointer bg-transparent border-0"
              >
                <span id="submitBtnText">
                  {loading ? 'در حال احراز هویت...' : 'ورود'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* AutoCAD Footer Bar */}
      <footer className="relative z-20 h-7 bg-[#0f1217] border-t border-[#262e38] px-3 flex items-center justify-between text-[11px] text-[#94a3b8]">
        <div className="flex items-center gap-3">
          <span
            id="statusPrompt"
            className="text-[#cbd5e1]"
            dangerouslySetInnerHTML={{ __html: statusPrompt }}
          />
        </div>

        <div className="flex items-center gap-4 font-mono-cad text-[11px]">
          <span id="coordReadout" className="text-[#e2e8f0] min-w-[185px] text-left">
            {coordText}
          </span>
          <span className="px-1.5 py-0.5 bg-[#1b222c] text-[#cbd5e1] border border-[#2e3846] text-[10px]">
            MODEL
          </span>
          <span className="text-[#8796a8] text-[10px]">GRID</span>
          <span className="text-[#8796a8] text-[10px]">ORT</span>
          <span className="text-[#d5b368] text-[10px]">OSNAP</span>
        </div>
      </footer>
    </div>
  );
}
