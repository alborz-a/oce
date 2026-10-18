// [RSC-IRAN] Center AutoCAD Floorplan SVG Component
import type React from 'react';

interface CadFloorplanSvgProps {
  svgRef: React.RefObject<SVGSVGElement>;
  tracerRef: React.RefObject<SVGGElement>;
  logoFillsRef: React.RefObject<SVGGElement>;
  logoWordmarkRef: React.RefObject<SVGGElement>;
  submitBoxFillRef: React.RefObject<SVGPathElement>;
  onReplayDrawing: () => void;
  emailFocused: boolean;
  passFocused: boolean;
  submitBtnHovered: boolean;
  hasError: boolean;
}

export function CadFloorplanSvg(props: CadFloorplanSvgProps) {
  return (
    <svg
      id="floorplanSvg"
      ref={props.svgRef}
      viewBox="0 0 370 535"
      className="w-full h-full overflow-visible"
    >
      <defs>
        <radialGradient id="logoBacklight">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.42" />
          <stop offset="65%" stopColor="#172538" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#14171c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Backlight behind the logo */}
      <ellipse cx="185" cy="165" rx="135" ry="135" fill="url(#logoBacklight)" />

      {/* LAYER 0: Architectural Axis Lines & Dimension Ticks */}
      <g id="layerDims" opacity="0.8">
        <line x1="185" y1="-16" x2="185" y2="551" stroke="#475569" strokeWidth="0.6" strokeDasharray="10 3 2 3" opacity="0.55" />
        <line x1="-16" y1="118" x2="386" y2="118" stroke="#475569" strokeWidth="0.6" strokeDasharray="10 3 2 3" opacity="0.55" />

        {/* Top Outer Dimension Line */}
        <line x1="20" y1="4" x2="350" y2="4" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="20" y1="0" x2="20" y2="14" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="350" y1="0" x2="350" y2="14" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="17" y1="7" x2="23" y2="1" stroke="#d4dce6" strokeWidth="1" />
        <line x1="347" y1="7" x2="353" y2="1" stroke="#d4dce6" strokeWidth="1" />
        <text x="185" y="1.5" textAnchor="middle" fill="#8796a8" className="font-mono-cad" fontSize="8.5">330.00</text>

        {/* Right Outer Dimension Line */}
        <line x1="366" y1="18" x2="366" y2="516" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="356" y1="18" x2="370" y2="18" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="356" y1="516" x2="370" y2="516" stroke="#6c7a89" strokeWidth="0.7" />
        <line x1="363" y1="21" x2="369" y2="15" stroke="#d4dce6" strokeWidth="1" />
        <line x1="363" y1="519" x2="369" y2="513" stroke="#d4dce6" strokeWidth="1" />
      </g>

      {/* ENTITY 1: Outer Floorplan Boundary Wall */}
      <g className="cad-entity" data-bbox="20,18,350,516">
        <path
          className="cad-stroke entity-stroke"
          d="M 350 18 L 20 18 L 20 516 L 350 516 Z"
          fill="none"
          stroke="#d4dce6"
          strokeWidth="1.5"
        />
        <path
          className="cad-stroke entity-stroke"
          d="M 345 23 L 25 23 L 25 511 L 345 511 Z"
          fill="none"
          stroke="#6c7a89"
          strokeWidth="0.75"
        />
        {/* Corner Structural Column Squares */}
        <rect x="345" y="18" width="5" height="5" fill="none" stroke="#d4dce6" strokeWidth="1" className="cad-stroke" />
        <rect x="20" y="18" width="5" height="5" fill="none" stroke="#d4dce6" strokeWidth="1" className="cad-stroke" />
        <rect x="345" y="511" width="5" height="5" fill="none" stroke="#d4dce6" strokeWidth="1" className="cad-stroke" />
        <rect x="20" y="511" width="5" height="5" fill="none" stroke="#d4dce6" strokeWidth="1" className="cad-stroke" />

        {/* Blue Grips when selected */}
        <rect className="cad-grip" x="347" y="15" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="17" y="15" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="347" y="513" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="17" y="513" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {/* ENTITY 2: Royal Star Logo Block */}
      <g id="entityLogo" className="cad-entity cursor-pointer" data-bbox="75,32,295,302" onClick={props.onReplayDrawing}>
        <g transform="translate(185, 118) scale(0.47)">
          {/* CAD Construction Circles */}
          <circle cx="0" cy="0" r="172" fill="none" stroke="#262e38" strokeWidth="1.1" strokeDasharray="6 4" />
          <circle cx="0" cy="-78" r="76" fill="none" stroke="#262e38" strokeWidth="0.9" strokeDasharray="4 4" />
          <circle cx="78" cy="0" r="76" fill="none" stroke="#262e38" strokeWidth="0.9" strokeDasharray="4 4" />
          <circle cx="0" cy="78" r="76" fill="none" stroke="#262e38" strokeWidth="0.9" strokeDasharray="4 4" />
          <circle cx="-78" cy="0" r="76" fill="none" stroke="#262e38" strokeWidth="0.9" strokeDasharray="4 4" />

          {/* Solid Logo Fills */}
          <g id="logoFills" ref={props.logoFillsRef} opacity="0">
            {/* Royal Star Outer Ogee Shield */}
            <path
              d="M 0 -172 C 4 -152, 14 -140, 34 -140 L 76 -140 C 116 -140, 140 -116, 140 -76 L 140 -34 C 140 -14, 152 -4, 172 0 C 152 4, 140 14, 140 34 L 140 76 C 140 116, 116 140, 76 140 L 34 140 C 14 140, 4 152, 0 172 C -4 152, -14 140, -34 140 L -76 140 C -116 140, -140 116, -140 76 L -140 34 C -140 14, -152 4, -172 0 C -152 -4, -140 -14, -140 -34 L -140 -76 C -140 -116, -116 -140, -76 -140 L -34 -140 C -14 -140, -4 -152, 0 -172 Z"
              fill="#094183"
            />
            {/* Four Gold 4-Pointed Stars */}
            <g fill="#d5b368">
              <path d="M 0 -156 C 4 -105, 25 -81, 74 -76 C 25 -71, 4 -48, 0 -2 C -4 -48, -25 -71, -74 -76 C -25 -81, -4 -105, 0 -156 Z" />
              <path d="M 76 -74 C 81 -25, 105 -4, 156 0 C 105 4, 81 25, 76 74 C 71 25, 48 4, 2 0 C 48 -4, 71 -25, 76 -74 Z" />
              <path fillRule="evenodd" d="M 0 2 C 4 48, 25 71, 74 76 C 25 81, 4 105, 0 156 C -4 105, -25 81, -74 76 C -25 71, -4 48, 0 2 Z M 0 49 C 2 67, 10 76, 28 78 C 10 80, 2 89, 0 107 C -2 89, -10 80, -28 78 C -10 76, -2 67, 0 49 Z" />
              <path d="M -76 -74 C -71 -25, -48 -4, -2 0 C -48 4, -71 25, -76 74 C -81 25, -105 4, -156 0 C -105 -4, -81 -25, -76 -74 Z" />
              <rect x="73.5" y="-76.5" width="3" height="3" />
              <rect x="-76.5" y="-76.5" width="3" height="3" />
              <rect x="73.5" y="73.5" width="3" height="3" />
              <rect x="-76.5" y="73.5" width="3" height="3" />
            </g>
            <rect x="-2.2" y="-2.2" width="4.4" height="4.4" fill="#094183" />
          </g>

          {/* Animated CAD Strokes of the Logo Emblem */}
          <path
            className="cad-stroke entity-stroke"
            d="M 0 -172 C 4 -152, 14 -140, 34 -140 L 76 -140 C 116 -140, 140 -116, 140 -76 L 140 -34 C 140 -14, 152 -4, 172 0 C 152 4, 140 14, 140 34 L 140 76 C 140 116, 116 140, 76 140 L 34 140 C 14 140, 4 152, 0 172 C -4 152, -14 140, -34 140 L -76 140 C -116 140, -140 116, -140 76 L -140 34 C -140 14, -152 4, -172 0 C -152 -4, -140 -14, -140 -34 L -140 -76 C -140 -116, -116 -140, -76 -140 L -34 -140 C -14 -140, -4 -152, 0 -172 Z"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.8"
          />
          <path
            className="cad-stroke entity-stroke"
            d="M 0 -156 C 4 -105, 25 -81, 74 -76 C 25 -71, 4 -48, 0 -2 C -4 -48, -25 -71, -74 -76 C -25 -81, -4 -105, 0 -156 Z"
            fill="none"
            stroke="#d5b368"
            strokeWidth="2.1"
          />
          <path
            className="cad-stroke entity-stroke"
            d="M 156 0 C 105 4, 81 25, 76 74 C 71 25, 48 4, 2 0 C 48 -4, 71 -25, 76 -74 C 81 -25, 105 -4, 156 0 Z"
            fill="none"
            stroke="#d5b368"
            strokeWidth="2.1"
          />
          <path
            className="cad-stroke entity-stroke"
            d="M 0 156 C -4 105, -25 81, -74 76 C -25 71, -4 48, 0 2 C 4 48, 25 71, 74 76 C 25 81, 4 105, 0 156 Z"
            fill="none"
            stroke="#d5b368"
            strokeWidth="2.1"
          />
          <path
            className="cad-stroke entity-stroke"
            d="M -156 0 C -105 -4, -81 -25, -76 -74 C -71 -25, -48 -4, -2 0 C -48 4, -71 25, -76 74 C -81 25, -105 4, -156 0 Z"
            fill="none"
            stroke="#d5b368"
            strokeWidth="2.1"
          />
          <path
            className="cad-stroke entity-stroke"
            d="M 0 49 C 2 67, 10 76, 28 78 C 10 80, 2 89, 0 107 C -2 89, -10 80, -28 78 C -10 76, -2 67, 0 49 Z"
            fill="none"
            stroke="#d5b368"
            strokeWidth="1.8"
          />

          {/* EXACT VECTOR WORDMARK WITH WHITE OUTER RIM & SEAMLESS TWO-PASS R */}
          <g id="logoWordmark" ref={props.logoWordmarkRef} transform="translate(0, 232)">
            {/* TWO-PASS SEAMLESS R + SWEEPING TAIL */}
            <g className="cad-stroke entity-stroke">
              {/* Pass A: Outer White Precision Border */}
              <text
                x="-128"
                y="0"
                fill="#094183"
                stroke="#ffffff"
                strokeOpacity="0.95"
                strokeWidth="2.2"
                fontFamily="Cinzel, serif"
                fontSize="72"
                fontWeight="700"
                textAnchor="middle"
                className="logo-precision-rim"
              >
                R
              </text>
              <path
                d="M -118 -14 C -102 6, -78 20, -48 20 C -31 20, -17 14, -9 5 C -18 12, -31 15, -46 14 C -72 13, -93 1, -108 -14 Z"
                fill="#094183"
                stroke="#ffffff"
                strokeOpacity="0.95"
                strokeWidth="2.2"
                className="logo-precision-rim"
              />
              {/* Pass B: Seamless Royal Blue Fill on Top (Erases Internal Seam) */}
              <text
                x="-128"
                y="0"
                fill="#094183"
                stroke="none"
                fontFamily="Cinzel, serif"
                fontSize="72"
                fontWeight="700"
                textAnchor="middle"
              >
                R
              </text>
              <path
                d="M -118 -14 C -102 6, -78 20, -48 20 C -31 20, -17 14, -9 5 C -18 12, -31 15, -46 14 C -72 13, -93 1, -108 -14 Z"
                fill="#094183"
                stroke="none"
              />
            </g>

            {/* Letter "O" with TRUE HOLLOW STAR CUTOUT and Precision Rim */}
            <path
              className="cad-stroke entity-stroke logo-precision-rim"
              fillRule="evenodd"
              d="M -55 -52 A 28 28 0 1 0 -55 4 A 28 28 0 1 0 -55 -52 Z M -55 -48 C -52.5 -31, -48 -26.5, -31 -24 C -48 -21.5, -52.5 -17, -55 0 C -57.5 -17, -62 -21.5, -79 -24 C -62 -26.5, -57.5 -31, -55 -48 Z"
              fill="#094183"
              stroke="#ffffff"
              strokeOpacity="0.95"
              strokeWidth="2"
            />

            {/* Letters "YAL" */}
            <text
              x="62"
              y="0"
              fill="#094183"
              stroke="#ffffff"
              strokeOpacity="0.95"
              strokeWidth="2"
              fontFamily="Cinzel, serif"
              fontSize="72"
              fontWeight="700"
              letterSpacing="1"
              textAnchor="middle"
              className="cad-stroke logo-precision-rim"
            >
              YAL
            </text>

            {/* Word "STAR" */}
            <text
              x="0"
              y="68"
              fill="#094183"
              stroke="#ffffff"
              strokeOpacity="0.95"
              strokeWidth="2"
              fontFamily="Cinzel, serif"
              fontSize="74"
              fontWeight="700"
              letterSpacing="3"
              textAnchor="middle"
              className="cad-stroke logo-precision-rim"
            >
              STAR
            </text>

            {/* Word "CONSTRUCTION" */}
            <text
              x="2"
              y="102"
              fill="#094183"
              stroke="#ffffff"
              strokeOpacity="0.95"
              strokeWidth="1.2"
              fontFamily="Vazirmatn, sans-serif"
              fontSize="25"
              fontWeight="700"
              letterSpacing="4.5"
              textAnchor="middle"
              className="cad-stroke logo-precision-rim"
            >
              CONSTRUCTION
            </text>
          </g>
        </g>

        {/* Logo Grips */}
        <rect className="cad-grip" x="182" y="34" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="268" y="118" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="182" y="205" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="96" y="118" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {/* Horizontal Partition Wall */}
      <g className="cad-entity" data-bbox="25,316,345,322">
        <line x1="345" y1="318" x2="25" y2="318" stroke="#6c7a89" strokeWidth="0.9" className="cad-stroke entity-stroke" />
        <line x1="345" y1="322" x2="25" y2="322" stroke="#3b4654" strokeWidth="0.6" strokeDasharray="6 3" className="cad-stroke" />
      </g>

      {/* ENTITY 3: Email Input Floorplan Slot */}
      <g id="entityEmail" className="cad-entity" data-bbox="45,342,325,386">
        <path
          id="emailBoxStroke"
          className="cad-stroke entity-stroke"
          d="M 325 342 L 45 342 L 45 386 L 325 386 Z"
          fill="rgba(255,255,255,0.01)"
          stroke={props.hasError ? '#ef4444' : props.emailFocused ? '#d5b368' : '#94a3b8'}
          strokeWidth={props.emailFocused || props.hasError ? 1.5 : 1.1}
        />
        <path d="M 325 348 L 319 342 M 51 342 L 45 348" stroke="#64748b" strokeWidth="0.7" className="cad-stroke" />
        <rect className="cad-grip" x="322" y="339" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="339" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="322" y="383" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="383" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {/* ENTITY 4: Password Input Floorplan Slot */}
      <g id="entityPassword" className="cad-entity" data-bbox="45,402,325,446">
        <path
          id="passBoxStroke"
          className="cad-stroke entity-stroke"
          d="M 325 402 L 45 402 L 45 446 L 325 446 Z"
          fill="rgba(255,255,255,0.01)"
          stroke={props.hasError ? '#ef4444' : props.passFocused ? '#d5b368' : '#94a3b8'}
          strokeWidth={props.passFocused || props.hasError ? 1.5 : 1.1}
        />
        <path d="M 325 408 L 319 402 M 51 402 L 45 408" stroke="#64748b" strokeWidth="0.7" className="cad-stroke" />
        <rect className="cad-grip" x="322" y="399" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="399" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="322" y="443" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="443" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {/* ENTITY 5: Submit Button Floorplan Block */}
      <g id="entitySubmit" className="cad-entity" data-bbox="45,462,325,502">
        <path
          id="submitBoxFill"
          ref={props.submitBoxFillRef}
          d="M 325 462 L 45 462 L 45 502 L 325 502 Z"
          fill={props.submitBtnHovered ? 'rgba(9, 65, 131, 0.55)' : 'rgba(9, 65, 131, 0.28)'}
          opacity="0"
        />
        <path
          id="submitBoxStroke"
          className="cad-stroke entity-stroke"
          d="M 325 462 L 45 462 L 45 502 L 325 502 Z"
          fill="none"
          stroke="#d5b368"
          strokeWidth={props.submitBtnHovered ? 1.7 : 1.25}
        />
        <line x1="325" y1="470" x2="317" y2="462" stroke="#d5b368" strokeWidth="0.8" className="cad-stroke" />
        <line x1="53" y1="502" x2="45" y2="494" stroke="#d5b368" strokeWidth="0.8" className="cad-stroke" />
        <rect className="cad-grip" x="322" y="459" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="459" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="322" y="499" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
        <rect className="cad-grip" x="42" y="499" width="6" height="6" fill="#0055ff" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {/* Live AutoCAD Drawing Crosshair & Pickbox Tracer */}
      <g id="cadTracer" ref={props.tracerRef} opacity="0" className="pointer-events-none">
        <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="#d5b368" strokeWidth="1" />
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#e2e8f0" strokeWidth="0.8" />
        <line x1="0" y1="-14" x2="0" y2="14" stroke="#e2e8f0" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
