// [RSC-IRAN] 4-Quadrant Animated Background AutoCAD Blueprint SVG
interface CadBackgroundSvgProps {
  isMobile: boolean;
}

export function CadBackgroundSvg({ isMobile }: CadBackgroundSvgProps) {
  return (
    <svg
      id="bgBlueprintSvg"
      viewBox={isMobile ? '40 20 1840 1040' : '0 0 1920 1080'}
      preserveAspectRatio={isMobile ? 'xMidYMid meet' : 'xMidYMid slice'}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    >
      {/* Outer Engineering Sheet Border & Coordinate Ticks */}
      <g stroke="#2a323d" fill="none">
        <rect x="28" y="24" width="1864" height="1012" strokeWidth="1.2" />
        <rect x="36" y="32" width="1848" height="996" strokeWidth="0.6" />
        {/* Center Sheet Reference Crosses */}
        <line x1="960" y1="24" x2="960" y2="42" strokeWidth="1" />
        <line x1="960" y1="1018" x2="960" y2="1036" strokeWidth="1" />
        <line x1="28" y1="530" x2="46" y2="530" strokeWidth="1" />
        <line x1="1874" y1="530" x2="1892" y2="530" strokeWidth="1" />
      </g>

      {/* ======================================================================= */}
      {/* QUADRANT 1 (TOP-RIGHT): 2D BUILDING ELEVATION, SECTION & FLOORPLAN      */}
      {/* ======================================================================= */}
      <g id="bgZone2DPlan" transform="translate(1225, 58)" opacity="0.38" stroke="#7d8c9e" fill="none">
        <line x1="0" y1="22" x2="630" y2="22" strokeWidth="0.9" />
        <text x="430" y="14" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="11.5" stroke="none">نمای دوبعدی ساختمان، برش سازه‌ای و پلان تیپ (2D CAD ELEVATION &amp; PLAN)</text>
        <text x="95" y="14" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9.5" stroke="none">SCALE 1:100 | DWG-AR-101</text>

        {/* SUB-PANEL 1A (RIGHT): 2D Architectural South Elevation & Structural Section */}
        <g transform="translate(315, 36)">
          {/* Structural Grid Axes 1-5 */}
          <g stroke="#3b4654" strokeWidth="0.55" strokeDasharray="7 3 2 3">
            <line x1="35" y1="14" x2="35" y2="395" />
            <line x1="95" y1="14" x2="95" y2="395" />
            <line x1="155" y1="14" x2="155" y2="395" />
            <line x1="215" y1="14" x2="215" y2="395" />
            <line x1="275" y1="14" x2="275" y2="395" />
          </g>
          {/* Grid Bubbles */}
          <g stroke="#7d8c9e" strokeWidth="0.75" fontFamily="JetBrains Mono" fontSize="8" fill="#94a3b8">
            <circle cx="35" cy="8" r="7" /><text x="35" y="11" textAnchor="middle" stroke="none">1</text>
            <circle cx="95" cy="8" r="7" /><text x="95" y="11" textAnchor="middle" stroke="none">2</text>
            <circle cx="155" cy="8" r="7" /><text x="155" y="11" textAnchor="middle" stroke="none">3</text>
            <circle cx="215" cy="8" r="7" /><text x="215" y="11" textAnchor="middle" stroke="none">4</text>
            <circle cx="275" cy="8" r="7" /><text x="275" y="11" textAnchor="middle" stroke="none">5</text>
          </g>

          {/* Rooftop Elevator Machine Room & Parapet */}
          <rect x="120" y="34" width="70" height="32" strokeWidth="1.1" />
          <line x1="114" y1="34" x2="196" y2="34" strokeWidth="1.4" />
          <rect x="135" y="42" width="16" height="16" strokeWidth="0.6" />
          <rect x="159" y="42" width="16" height="16" strokeWidth="0.6" />
          <text x="155" y="29" textAnchor="middle" fill="#64748b" fontFamily="Vazirmatn" fontSize="8.5" stroke="none">خرپشته و اتاق آسانسور</text>

          {/* Main 6-Story Tower Facade */}
          <rect x="35" y="66" width="240" height="270" strokeWidth="1.5" />
          <rect x="10" y="246" width="290" height="90" strokeWidth="1.2" />

          {/* Horizontal Floor Slabs */}
          <g strokeWidth="0.8">
            <line x1="30" y1="66" x2="280" y2="66" strokeWidth="1.5" />
            <line x1="35" y1="70" x2="275" y2="70" />
            <line x1="35" y1="111" x2="275" y2="111" />
            <line x1="35" y1="114" x2="275" y2="114" strokeWidth="0.5" />
            <line x1="35" y1="156" x2="275" y2="156" />
            <line x1="35" y1="159" x2="275" y2="159" strokeWidth="0.5" />
            <line x1="35" y1="201" x2="275" y2="201" />
            <line x1="35" y1="204" x2="275" y2="204" strokeWidth="0.5" />
            <line x1="10" y1="246" x2="300" y2="246" />
            <line x1="10" y1="249" x2="300" y2="249" strokeWidth="0.5" />
            <line x1="10" y1="291" x2="300" y2="291" />
            <line x1="10" y1="294" x2="300" y2="294" strokeWidth="0.5" />
          </g>

          {/* Windows & Mullions */}
          <g strokeWidth="0.6">
            <rect x="43" y="76" width="44" height="29" />
            <line x1="65" y1="76" x2="65" y2="105" />
            <rect x="43" y="121" width="44" height="29" />
            <line x1="65" y1="121" x2="65" y2="150" />
            <rect x="43" y="166" width="44" height="29" />
            <line x1="65" y1="166" x2="65" y2="195" />
            <rect x="43" y="211" width="44" height="29" />
            <line x1="65" y1="211" x2="65" y2="240" />
            <line x1="47" y1="82" x2="55" y2="96" />
            <line x1="47" y1="127" x2="55" y2="141" />
            <line x1="47" y1="172" x2="55" y2="186" />

            <rect x="103" y="76" width="44" height="164" />
            <line x1="125" y1="76" x2="125" y2="240" />
            <line x1="103" y1="130" x2="147" y2="130" />
            <line x1="103" y1="185" x2="147" y2="185" />
          </g>

          {/* Cross Bracing with Dash Flow Animation */}
          <g strokeWidth="0.75" strokeDasharray="4 2" className="anim-dash-flow">
            <line x1="155" y1="70" x2="215" y2="111" />
            <line x1="215" y1="70" x2="155" y2="111" />
            <line x1="155" y1="114" x2="215" y2="156" />
            <line x1="215" y1="114" x2="155" y2="156" />
            <line x1="155" y1="159" x2="215" y2="201" />
            <line x1="215" y1="159" x2="155" y2="201" />
            <line x1="155" y1="204" x2="215" y2="246" />
            <line x1="215" y1="204" x2="155" y2="246" />
            <line x1="155" y1="249" x2="215" y2="291" />
            <line x1="215" y1="249" x2="155" y2="291" />
            <line x1="155" y1="294" x2="215" y2="336" />
            <line x1="215" y1="294" x2="155" y2="336" />
          </g>

          {/* Animated Elevator Cab inside shaft */}
          <g transform="translate(138, 290)">
            <rect className="anim-elevator-cab" x="0" y="0" width="28" height="34" stroke="#d5b368" strokeWidth="1" fill="rgba(213, 179, 104, 0.12)" />
          </g>

          {/* Balconies */}
          <g strokeWidth="0.65">
            <rect x="223" y="76" width="44" height="29" />
            <line x1="220" y1="96" x2="270" y2="96" strokeWidth="0.9" />
            <rect x="223" y="121" width="44" height="29" />
            <line x1="220" y1="141" x2="270" y2="141" strokeWidth="0.9" />
            <rect x="223" y="166" width="44" height="29" />
            <line x1="220" y1="186" x2="270" y2="186" strokeWidth="0.9" />
            <rect x="223" y="211" width="44" height="29" />
            <line x1="220" y1="231" x2="270" y2="231" strokeWidth="0.9" />
          </g>

          {/* Ground Entrance */}
          <rect x="115" y="302" width="40" height="34" strokeWidth="1" />
          <line x1="135" y1="302" x2="135" y2="336" strokeWidth="0.8" />
          <line x1="102" y1="300" x2="168" y2="300" strokeWidth="1.6" />

          {/* Mat Foundation and Piles */}
          <line x1="0" y1="336" x2="310" y2="336" strokeWidth="1.8" />
          <rect x="8" y="336" width="294" height="22" strokeWidth="1.1" />
          <g strokeWidth="0.5" stroke="#526071">
            <line x1="20" y1="336" x2="10" y2="358" />
            <line x1="45" y1="336" x2="35" y2="358" />
            <line x1="70" y1="336" x2="60" y2="358" />
            <line x1="95" y1="336" x2="85" y2="358" />
            <line x1="120" y1="336" x2="110" y2="358" />
            <line x1="145" y1="336" x2="135" y2="358" />
            <line x1="170" y1="336" x2="160" y2="358" />
            <line x1="195" y1="336" x2="185" y2="358" />
            <line x1="220" y1="336" x2="210" y2="358" />
            <line x1="245" y1="336" x2="235" y2="358" />
            <line x1="270" y1="336" x2="260" y2="358" />
            <line x1="295" y1="336" x2="285" y2="358" />
          </g>
          <rect x="30" y="358" width="10" height="26" strokeWidth="0.8" />
          <rect x="90" y="358" width="10" height="26" strokeWidth="0.8" />
          <rect x="150" y="358" width="10" height="26" strokeWidth="0.8" />
          <rect x="210" y="358" width="10" height="26" strokeWidth="0.8" />
          <rect x="270" y="358" width="10" height="26" strokeWidth="0.8" />

          {/* Levels */}
          <g fontFamily="JetBrains Mono" fontSize="7.5" fill="#94a3b8" stroke="none">
            <text x="295" y="63" textAnchor="middle">+21.60</text>
            <text x="295" y="153" textAnchor="middle">+14.40</text>
            <text x="295" y="243" textAnchor="middle">+07.20</text>
            <text x="295" y="332" textAnchor="middle">±00.00</text>
          </g>

          {/* Animated Laser Elevation Scanner */}
          <line className="anim-elevation-scan" x1="10" y1="336" x2="300" y2="336" stroke="#d5b368" strokeWidth="1.2" opacity="0.6" strokeDasharray="6 4" />
          <text x="155" y="402" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" stroke="none">نمای جنوبی و برش قاب مهاربندی‌شده (SECTION A-A)</text>
        </g>

        {/* SUB-PANEL 1B (LEFT): 2D Typical Floorplan & Core */}
        <g transform="translate(0, 36)">
          <g stroke="#3b4654" strokeWidth="0.55" strokeDasharray="7 3 2 3">
            <line x1="28" y1="18" x2="28" y2="335" />
            <line x1="112" y1="18" x2="112" y2="335" />
            <line x1="196" y1="18" x2="196" y2="335" />
            <line x1="276" y1="18" x2="276" y2="335" />
            <line x1="10" y1="38" x2="292" y2="38" />
            <line x1="10" y1="175" x2="292" y2="175" />
            <line x1="10" y1="312" x2="292" y2="312" />
          </g>
          <g stroke="#7d8c9e" strokeWidth="0.75" fontFamily="JetBrains Mono" fontSize="8" fill="#94a3b8">
            <circle cx="28" cy="8" r="7" /><text x="28" y="11" textAnchor="middle" stroke="none">A</text>
            <circle cx="112" cy="8" r="7" /><text x="112" y="11" textAnchor="middle" stroke="none">B</text>
            <circle cx="196" cy="8" r="7" /><text x="196" y="11" textAnchor="middle" stroke="none">C</text>
            <circle cx="276" cy="8" r="7" /><text x="276" y="11" textAnchor="middle" stroke="none">D</text>
          </g>

          {/* Walls */}
          <rect x="24" y="34" width="256" height="282" strokeWidth="1.5" />
          <rect x="29" y="39" width="246" height="272" strokeWidth="0.7" />
          <line x1="112" y1="39" x2="112" y2="311" strokeWidth="1.1" />
          <line x1="196" y1="39" x2="196" y2="175" strokeWidth="1.1" />
          <line x1="29" y1="175" x2="275" y2="175" strokeWidth="1.1" />

          {/* Columns */}
          <g fill="#7d8c9e">
            <rect x="24" y="34" width="7" height="7" />
            <rect x="108.5" y="34" width="7" height="7" />
            <rect x="192.5" y="34" width="7" height="7" />
            <rect x="273" y="34" width="7" height="7" />
            <rect x="24" y="171.5" width="7" height="7" />
            <rect x="108.5" y="171.5" width="7" height="7" />
            <rect x="192.5" y="171.5" width="7" height="7" />
            <rect x="273" y="171.5" width="7" height="7" />
            <rect x="24" y="309" width="7" height="7" />
            <rect x="108.5" y="309" width="7" height="7" />
            <rect x="192.5" y="309" width="7" height="7" />
            <rect x="273" y="309" width="7" height="7" />
          </g>

          {/* Core & Stairs */}
          <rect x="122" y="95" width="64" height="68" strokeWidth="1.2" />
          <line x1="122" y1="95" x2="186" y2="163" strokeWidth="0.5" strokeDasharray="3 2" />
          <line x1="186" y1="95" x2="122" y2="163" strokeWidth="0.5" strokeDasharray="3 2" />
          <g strokeWidth="0.55">
            <rect x="122" y="175" width="56" height="44" />
            <line x1="130" y1="175" x2="130" y2="219" />
            <line x1="138" y1="175" x2="138" y2="219" />
            <line x1="146" y1="175" x2="146" y2="219" />
            <line x1="154" y1="175" x2="154" y2="219" />
            <line x1="162" y1="175" x2="162" y2="219" />
            <line x1="170" y1="175" x2="170" y2="219" />
          </g>

          <path d="M 112 78 L 136 78 A 24 24 0 0 0 112 54" strokeWidth="0.7" strokeDasharray="2 2" />
          <path d="M 196 142 L 220 142 A 24 24 0 0 1 196 166" strokeWidth="0.7" strokeDasharray="2 2" />
          <path d="M 85 175 L 85 199 A 24 24 0 0 1 61 175" strokeWidth="0.7" strokeDasharray="2 2" />

          {/* Sequential Room QTO Highlights */}
          <rect className="anim-room-1" x="30" y="40" width="81" height="134" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.7" />
          <rect className="anim-room-2" x="197" y="40" width="77" height="134" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.7" />
          <rect className="anim-room-3" x="113" y="176" width="161" height="134" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.7" />
          <rect className="anim-room-4" x="30" y="176" width="81" height="134" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.7" />

          {/* Moving Crosshair */}
          <g className="anim-plan-crosshair">
            <circle cx="0" cy="0" r="8" stroke="#d5b368" strokeWidth="0.9" fill="none" />
            <line x1="-12" y1="0" x2="12" y2="0" stroke="#d5b368" strokeWidth="0.9" />
            <line x1="0" y1="-12" x2="0" y2="12" stroke="#d5b368" strokeWidth="0.9" />
          </g>

          <text x="70" y="102" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9" stroke="none">دفتر فنی و مهندسی</text>
          <text x="70" y="115" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="8" stroke="none">148.5 m²</text>
          <text x="235" y="102" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9" stroke="none">اتاق کنفرانس</text>
          <text x="235" y="115" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="8" stroke="none">96.0 m²</text>
          <text x="205" y="255" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9" stroke="none">زون اداری و آرشیو شاپ‌دراوینگ</text>
          <text x="70" y="255" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9" stroke="none">لابی و پذیرش</text>

          <line x1="24" y1="348" x2="280" y2="348" strokeWidth="0.6" />
          <text x="152" y="360" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="8" stroke="none">24.80 m (4 BAYS @ 6.20m)</text>
          <text x="152" y="402" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" stroke="none">پلان ستون‌گذاری و دیوارچینی تیپ طبقات (TYPICAL PLAN)</text>
        </g>
      </g>

      {/* ======================================================================= */}
      {/* QUADRANT 2 (TOP-LEFT): 3D ISOMETRIC BUILDING + GANTT (CPM) + KANBAN     */}
      {/* ======================================================================= */}
      <g id="bgZone3DBim" transform="translate(65, 58)" opacity="0.38" stroke="#7d8c9e" fill="none">
        <line x1="0" y1="22" x2="640" y2="22" strokeWidth="0.9" />
        <text x="435" y="14" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="11.5" stroke="none">مدل سه‌بعدی سازه (BIM 4D)، گانت چارت مسیر بحرانی (CPM) و کانبان</text>
        <text x="95" y="14" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9.5" stroke="none">IFC4 | LOD 350 | 4D-CPM</text>

        {/* SUB-PANEL 2A (LEFT): 3D Isometric Building + Shear Core + Tower Crane */}
        <g transform="translate(155, 52)">
          {/* 3D Tower Crane next to building */}
          <g stroke="#64748b" strokeWidth="0.7">
            {/* Crane Mast Lattice */}
            <rect x="-132" y="-12" width="12" height="285" />
            <line x1="-132" y1="10" x2="-120" y2="30" />
            <line x1="-120" y1="30" x2="-132" y2="50" />
            <line x1="-132" y1="50" x2="-120" y2="70" />
            <line x1="-120" y1="70" x2="-132" y2="90" />
            <line x1="-132" y1="90" x2="-120" y2="110" />
            <line x1="-120" y1="110" x2="-132" y2="130" />
            <line x1="-132" y1="130" x2="-120" y2="150" />
            <line x1="-120" y1="150" x2="-132" y2="170" />
            <line x1="-132" y1="170" x2="-120" y2="190" />
            {/* Crane Jib & Counter-Jib */}
            <line x1="-152" y1="-12" x2="65" y2="-12" strokeWidth="1.1" />
            <line x1="-126" y1="-28" x2="-126" y2="-12" strokeWidth="1" />
            <line x1="-126" y1="-28" x2="45" y2="-12" strokeDasharray="3 2" />
            <line x1="-126" y1="-28" x2="-148" y2="-12" strokeDasharray="3 2" />
            <rect x="-150" y="-10" width="14" height="9" fill="#3b4654" />
            {/* Animated Trolley and Hoist Hook */}
            <g className="anim-crane-trolley">
              <line className="anim-crane-hook" x1="18" y1="-12" x2="18" y2="28" strokeDasharray="2 2" />
              <rect x="14" y="28" width="8" height="6" fill="#d5b368" />
            </g>
          </g>

          {/* Isometric Foundation Mat Pad */}
          <polygon points="0,192 138,248 0,304 -138,248" strokeWidth="1.4" fill="rgba(125,140,158,0.04)" />
          <polygon points="0,204 138,260 0,316 -138,260" strokeWidth="0.9" strokeDasharray="4 2" />
          <line x1="-138" y1="248" x2="-138" y2="260" strokeWidth="1.1" />
          <line x1="138" y1="248" x2="138" y2="260" strokeWidth="1.1" />
          <line x1="0" y1="304" x2="0" y2="316" strokeWidth="1.1" />

          {/* 5-Story Building Slabs with 4D Construction Wave */}
          <polygon className="anim-slab-1" points="0,152 120,202 0,252 -120,202" strokeWidth="1" />
          <polygon className="anim-slab-2" points="0,114 120,164 0,214 -120,164" strokeWidth="1" />
          <polygon className="anim-slab-3" points="0,76 120,126 0,176 -120,126" strokeWidth="1" />
          <polygon className="anim-slab-4" points="0,38 120,88 0,138 -120,88" strokeWidth="1" />
          <polygon className="anim-slab-5" points="0,0 120,50 0,100 -120,50" strokeWidth="1.4" fill="rgba(125,140,158,0.05)" />
          <polygon points="0,-6 120,44 0,94 -120,44" strokeWidth="0.8" />

          {/* Central Shear Wall Core */}
          <polygon points="0,18 36,33 0,48 -36,33" strokeWidth="1.1" fill="rgba(125,140,158,0.08)" />
          <line x1="-36" y1="33" x2="-36" y2="225" strokeWidth="0.9" strokeDasharray="3 2" />
          <line x1="36" y1="33" x2="36" y2="225" strokeWidth="0.9" strokeDasharray="3 2" />
          <line x1="0" y1="48" x2="0" y2="240" strokeWidth="1.1" strokeDasharray="3 2" />

          {/* Columns */}
          <line x1="-120" y1="44" x2="-120" y2="240" strokeWidth="1.4" />
          <line x1="120" y1="44" x2="120" y2="240" strokeWidth="1.4" />
          <line x1="0" y1="94" x2="0" y2="290" strokeWidth="1.6" />
          <line x1="-60" y1="75" x2="-60" y2="265" strokeWidth="1" />
          <line x1="60" y1="75" x2="60" y2="265" strokeWidth="1" />
          <line x1="-60" y1="25" x2="-60" y2="215" strokeWidth="0.7" strokeDasharray="3 3" />
          <line x1="60" y1="25" x2="60" y2="215" strokeWidth="0.7" strokeDasharray="3 3" />

          {/* Lateral Bracing */}
          <g strokeWidth="0.7" stroke="#94a3b8">
            <line x1="-60" y1="75" x2="0" y2="138" />
            <line x1="0" y1="100" x2="-60" y2="113" />
            <line x1="-60" y1="151" x2="0" y2="214" />
            <line x1="0" y1="176" x2="-60" y2="189" />
            <line x1="60" y1="75" x2="0" y2="138" />
            <line x1="0" y1="100" x2="60" y2="113" />
            <line x1="60" y1="151" x2="0" y2="214" />
            <line x1="0" y1="176" x2="60" y2="189" />
          </g>

          <text x="0" y="338" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" stroke="none">مدل سه‌بعدی اسکلت، هسته برشی و تاورکرین (3D BIM MODEL)</text>
        </g>

        {/* SUB-PANEL 2B (TOP-RIGHT): 4D Gantt Chart with Critical Path */}
        <g transform="translate(310, 36)">
          <rect x="0" y="0" width="330" height="175" strokeWidth="1.1" />
          <line x1="0" y1="26" x2="330" y2="26" strokeWidth="0.9" />
          <text x="220" y="17" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" fontWeight="600" stroke="none">گانت چارت و مسیر بحرانی پروژه (4D GANTT &amp; CPM)</text>
          <text x="52" y="17" textAnchor="middle" fill="#d5b368" fontFamily="JetBrains Mono" fontSize="8.5" stroke="none">CRITICAL PATH</text>

          <line x1="215" y1="26" x2="215" y2="175" strokeWidth="0.8" />
          <g stroke="#3b4654" strokeWidth="0.5" strokeDasharray="3 3">
            <line x1="43" y1="26" x2="43" y2="175" />
            <line x1="86" y1="26" x2="86" y2="175" />
            <line x1="129" y1="26" x2="129" y2="175" />
            <line x1="172" y1="26" x2="172" y2="175" />
          </g>
          <line x1="0" y1="56" x2="330" y2="56" strokeWidth="0.5" />
          <line x1="0" y1="86" x2="330" y2="86" strokeWidth="0.5" />
          <line x1="0" y1="116" x2="330" y2="116" strokeWidth="0.5" />
          <line x1="0" y1="146" x2="330" y2="146" strokeWidth="0.5" />

          {/* WBS Tasks */}
          <g fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8.5" stroke="none">
            <text x="272.5" y="45" textAnchor="middle">۱. تجهیز کارگاه و گودبرداری</text>
            <text x="272.5" y="75" textAnchor="middle">۲. اجرای فونداسیون و شمع</text>
            <text x="272.5" y="105" textAnchor="middle">۳. اسکلت و دال بتنی طبقات</text>
            <text x="272.5" y="135" textAnchor="middle">۴. وال‌پست، سفت‌کاری و نما</text>
            <text x="272.5" y="164" textAnchor="middle">۵. تحویل موقت و صورت‌وضعیت</text>
          </g>

          {/* Gantt Bars */}
          <rect className="anim-gantt-bar" x="165" y="36" width="40" height="10" stroke="#d5b368" strokeWidth="1.1" fill="rgba(213,179,104,0.22)" />
          <rect className="anim-gantt-bar" x="122" y="66" width="42" height="10" stroke="#d5b368" strokeWidth="1.1" fill="rgba(213,179,104,0.22)" />
          <rect className="anim-gantt-bar" x="68" y="96" width="52" height="10" stroke="#d5b368" strokeWidth="1.1" fill="rgba(213,179,104,0.22)" />
          <rect x="42" y="126" width="38" height="10" stroke="#7d8c9e" strokeWidth="0.9" fill="rgba(125,140,158,0.15)" />
          <line x1="20" y1="131" x2="42" y2="131" stroke="#7d8c9e" strokeWidth="0.8" strokeDasharray="2 2" />
          <text x="31" y="124" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="6.5" stroke="none">TF:14d</text>
          <rect className="anim-gantt-bar" x="22" y="156" width="44" height="10" stroke="#d5b368" strokeWidth="1.1" fill="rgba(213,179,104,0.22)" />
          <polygon points="14,155 20,161 14,167 8,161" stroke="#d5b368" strokeWidth="1.1" fill="#d5b368" />

          {/* Finish-to-Start Dependency Flow */}
          <g stroke="#d5b368" strokeWidth="0.9" className="anim-cpm-flow">
            <path d="M 165 41 L 158 41 L 158 66" />
            <path d="M 122 71 L 114 71 L 114 96" />
            <path d="M 68 101 L 60 101 L 60 156" />
          </g>

          {/* Sweeping Timeline Playhead */}
          <line className="anim-gantt-playhead" x1="205" y1="26" x2="205" y2="175" stroke="#d5b368" strokeWidth="1.2" />
        </g>

        {/* SUB-PANEL 2C (BOTTOM-RIGHT): Kanban Board */}
        <g transform="translate(310, 224)">
          <rect x="0" y="0" width="330" height="168" strokeWidth="1.1" />
          <line x1="0" y1="26" x2="330" y2="26" strokeWidth="0.9" />
          <text x="165" y="17" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" fontWeight="600" stroke="none">کانبان برد وظایف کارگاه و دفتر فنی (KANBAN BOARD)</text>

          <line x1="110" y1="26" x2="110" y2="168" strokeWidth="0.7" />
          <line x1="220" y1="26" x2="220" y2="168" strokeWidth="0.7" />
          <line x1="0" y1="48" x2="330" y2="48" strokeWidth="0.6" />

          <g fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8.5" stroke="none">
            <text x="275" y="41" textAnchor="middle">در انتظار (TO DO)</text>
            <text x="165" y="41" textAnchor="middle" fill="#d5b368">در حال اجرا (WIP)</text>
            <text x="55" y="41" textAnchor="middle">تأیید شده (DONE)</text>
          </g>

          {/* Cards in TO DO */}
          <rect x="228" y="56" width="94" height="46" strokeWidth="0.75" />
          <text x="275" y="73" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8" stroke="none">تأیید شاپ‌دراوینگ نما</text>
          <text x="275" y="91" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">SHP-AR-08 | BIM</text>

          <rect x="228" y="110" width="94" height="46" strokeWidth="0.75" />
          <text x="275" y="127" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8" stroke="none">استعلام بها (RFQ) میلگرد</text>
          <text x="275" y="145" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">RFQ-PR-14 | A3</text>

          {/* Cards in WIP */}
          <rect x="118" y="56" width="94" height="46" stroke="#d5b368" strokeWidth="0.9" fill="rgba(213,179,104,0.06)" />
          <text x="165" y="73" textAnchor="middle" fill="#e2e8f0" fontFamily="Vazirmatn" fontSize="8" stroke="none">آرماتوربندی دال طبقه ۳</text>
          <text x="165" y="91" textAnchor="middle" fill="#d5b368" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">WBS-03.2 | QC</text>

          <rect x="118" y="110" width="94" height="46" strokeWidth="0.75" />
          <text x="165" y="127" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8" stroke="none">تداخل‌سنجی تأسیسات</text>
          <text x="165" y="145" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">CLASH-MEP-04</text>

          {/* Cards in DONE */}
          <rect x="8" y="56" width="94" height="46" strokeWidth="0.75" />
          <text x="55" y="73" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8" stroke="none">بتن‌ریزی فونداسیون</text>
          <text x="55" y="91" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">C35 | LAB-OK ✓</text>

          <rect x="8" y="110" width="94" height="46" strokeWidth="0.75" />
          <text x="55" y="127" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="8" stroke="none">صورت‌وضعیت موقت شماره ۲</text>
          <text x="55" y="145" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="7.5" stroke="none">IPC-02 | APPROVED ✓</text>
        </g>
      </g>

      {/* ======================================================================= */}
      {/* QUADRANT 3 (BOTTOM-RIGHT): BOQ & COST ESTIMATION SCHEDULE TABLE (RTL)   */}
      {/* ======================================================================= */}
      <g id="bgZoneBoq" transform="translate(1225, 560)" opacity="0.38" stroke="#7d8c9e" fill="none">
        <line x1="0" y1="22" x2="630" y2="22" strokeWidth="0.9" />
        <text x="435" y="14" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="11.5" stroke="none">جدول خلاصه متره و برآورد فهرست‌بها و آنالیز بها (BOQ &amp; COST SUMMARY)</text>
        <text x="90" y="14" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9.5" stroke="none">REF: IR-1405-BOQ</text>

        {/* Schedule Outer Frame & Rows */}
        <rect x="0" y="34" width="630" height="296" strokeWidth="1.1" />
        <line x1="0" y1="66" x2="630" y2="66" strokeWidth="1" />
        <line x1="0" y1="102" x2="630" y2="102" strokeWidth="0.6" />
        <line x1="0" y1="138" x2="630" y2="138" strokeWidth="0.6" />
        <line x1="0" y1="174" x2="630" y2="174" strokeWidth="0.6" />
        <line x1="0" y1="210" x2="630" y2="210" strokeWidth="0.6" />
        <line x1="0" y1="246" x2="630" y2="246" strokeWidth="0.6" />
        <line x1="0" y1="286" x2="630" y2="286" strokeWidth="1" />

        {/* Vertical Column Lines */}
        <line x1="560" y1="34" x2="560" y2="286" strokeWidth="0.7" />
        <line x1="310" y1="34" x2="310" y2="286" strokeWidth="0.7" />
        <line x1="245" y1="34" x2="245" y2="286" strokeWidth="0.7" />
        <line x1="150" y1="34" x2="150" y2="330" strokeWidth="0.7" />

        {/* Stepped Active-Row Scanner */}
        <g className="anim-boq-scan">
          <rect x="1" y="67" width="628" height="34" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.8" />
        </g>

        {/* Table Cells: Midpoints x=595, 435, 277.5, 197.5, 75 */}
        <g fill="#94a3b8" fontFamily="Vazirmatn" fontSize="10" stroke="none">
          <text x="595" y="54" textAnchor="middle" fontWeight="600">کد فصل</text>
          <text x="435" y="54" textAnchor="middle" fontWeight="600">شرح سرفصل فهرست‌بها (ابنیه و سازه)</text>
          <text x="277.5" y="54" textAnchor="middle" fontWeight="600">واحد</text>
          <text x="197.5" y="54" textAnchor="middle" fontWeight="600">مقدار (ریزه‌متره)</text>
          <text x="75" y="54" textAnchor="middle" fontWeight="600">مبلغ کل (ریال)</text>

          {/* Row 1 */}
          <text x="595" y="88" textAnchor="middle" fontFamily="JetBrains Mono">02-01</text>
          <text x="435" y="88" textAnchor="middle">خاک‌برداری و اجرای سازه نگهبان</text>
          <text x="277.5" y="88" textAnchor="middle" fontFamily="JetBrains Mono">m³</text>
          <text x="197.5" y="88" textAnchor="middle">۴٬۸۵۰</text>
          <text x="75" y="88" textAnchor="middle">۱۴٬۵۵۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Row 2 */}
          <text x="595" y="124" textAnchor="middle" fontFamily="JetBrains Mono">07-04</text>
          <text x="435" y="124" textAnchor="middle">قالب‌بندی و آرماتوربندی فونداسیون و دال</text>
          <text x="277.5" y="124" textAnchor="middle" fontFamily="JetBrains Mono">kg</text>
          <text x="197.5" y="124" textAnchor="middle">۱۲۸٬۴۰۰</text>
          <text x="75" y="124" textAnchor="middle">۶۴٬۲۰۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Row 3 */}
          <text x="595" y="160" textAnchor="middle" fontFamily="JetBrains Mono">08-02</text>
          <text x="435" y="160" textAnchor="middle">بتن‌ریزی سازه‌ای C35 و عمل‌آوری (کیورینگ)</text>
          <text x="277.5" y="160" textAnchor="middle" fontFamily="JetBrains Mono">m³</text>
          <text x="197.5" y="160" textAnchor="middle">۲٬۱۳۰</text>
          <text x="75" y="160" textAnchor="middle">۳۸٬۳۴۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Row 4 */}
          <text x="595" y="196" textAnchor="middle" fontFamily="JetBrains Mono">09-11</text>
          <text x="435" y="196" textAnchor="middle">اسکلت فلزی، بادبند و وال‌پست کارگاهی</text>
          <text x="277.5" y="196" textAnchor="middle" fontFamily="JetBrains Mono">kg</text>
          <text x="197.5" y="196" textAnchor="middle">۹۴٬۶۰۰</text>
          <text x="75" y="196" textAnchor="middle">۵۶٬۷۶۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Row 5 */}
          <text x="595" y="232" textAnchor="middle" fontFamily="JetBrains Mono">16-05</text>
          <text x="435" y="232" textAnchor="middle">نماسازی کرتین‌وال و دتیل‌های اجرایی معماری</text>
          <text x="277.5" y="232" textAnchor="middle" fontFamily="JetBrains Mono">m²</text>
          <text x="197.5" y="232" textAnchor="middle">۳٬۴۲۰</text>
          <text x="75" y="232" textAnchor="middle">۲۹٬۰۷۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Row 6 */}
          <text x="595" y="270" textAnchor="middle" fontFamily="JetBrains Mono">28-01</text>
          <text x="435" y="270" textAnchor="middle">تجهیز کارگاه و ماشین‌آلات کارگاهی (مقطوع)</text>
          <text x="277.5" y="270" textAnchor="middle">چکی</text>
          <text x="197.5" y="270" textAnchor="middle">۱</text>
          <text x="75" y="270" textAnchor="middle">۱۲٬۴۰۰٬۰۰۰٬۰۰۰ ریال</text>

          {/* Footer Total */}
          <text x="390" y="313" textAnchor="middle" fontWeight="700" fill="#cbd5e1">جمع کل برآورد فهرست‌بها با ضرایب بالاسری، تجهیز و پیمان:</text>
          <text x="75" y="313" textAnchor="middle" fontWeight="700" fill="#d5b368">۲۱۵٬۳۲۰٬۰۰۰٬۰۰۰ ریال</text>
        </g>
      </g>

      {/* ======================================================================= */}
      {/* QUADRANT 4 (BOTTOM-LEFT): TERMINAL DIRECTORY TREE + CDE TABLE + STAMP   */}
      {/* ======================================================================= */}
      <g id="bgZoneDocs" transform="translate(65, 560)" opacity="0.38" stroke="#7d8c9e" fill="none">
        <line x1="0" y1="22" x2="640" y2="22" strokeWidth="0.9" />
        <text x="440" y="14" textAnchor="middle" fill="#94a3b8" fontFamily="Vazirmatn" fontSize="11.5" stroke="none">مدیریت فایل‌های پروژه (CDE TREE)، شاپ‌دراوینگ و استعلام فنی (RFI / NCR)</text>
        <text x="90" y="14" textAnchor="middle" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9.5" stroke="none">ISO 19650 | CDE-LOG</text>

        {/* SUB-PANEL 4A (LEFT): Terminal-Style Project File Directory Tree */}
        <g transform="translate(0, 34)">
          <rect x="0" y="0" width="255" height="200" strokeWidth="1.1" fill="rgba(15,18,23,0.35)" />
          <line x1="0" y1="24" x2="255" y2="24" strokeWidth="0.8" />
          {/* Terminal Dots */}
          <circle cx="12" cy="12" r="3" strokeWidth="0.8" />
          <circle cx="22" cy="12" r="3" strokeWidth="0.8" />
          <circle cx="32" cy="12" r="3" strokeWidth="0.8" />
          <text x="145" y="15" direction="ltr" unicodeBidi="isolate" textAnchor="middle" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="8.5" stroke="none">tree /srv/oce/rsc-1405</text>

          {/* Scanning Line */}
          <line className="anim-tree-scan" x1="2" y1="26" x2="253" y2="26" stroke="#d5b368" strokeWidth="0.9" opacity="0.6" />

          {/* Vector Tree Branch Lines */}
          <g stroke="#64748b" strokeWidth="0.85">
            <line x1="16" y1="44" x2="16" y2="177" />
            <line x1="16" y1="51" x2="26" y2="51" />
            <line x1="30" y1="56" x2="30" y2="79" />
            <line x1="30" y1="65" x2="40" y2="65" />
            <line x1="30" y1="79" x2="40" y2="79" />
            <line x1="16" y1="93" x2="26" y2="93" />
            <line x1="30" y1="98" x2="30" y2="121" />
            <line x1="30" y1="107" x2="40" y2="107" />
            <line x1="30" y1="121" x2="40" y2="121" />
            <line x1="16" y1="135" x2="26" y2="135" />
            <line x1="30" y1="140" x2="30" y2="163" />
            <line x1="30" y1="149" x2="40" y2="149" />
            <line x1="30" y1="163" x2="40" y2="163" />
            <line x1="16" y1="177" x2="26" y2="177" />
            <line x1="30" y1="182" x2="30" y2="190" />
            <line x1="30" y1="190" x2="40" y2="190" />
          </g>

          {/* Monospace Directory Filenames */}
          <g fontFamily="JetBrains Mono" fontSize="8.2" fill="#94a3b8" stroke="none" direction="ltr" unicodeBidi="isolate" textAnchor="start">
            <text x="12" y="40" fill="#d5b368">rsc-tower-1405/</text>
            <text x="30" y="54" fill="#cbd5e1">01-BIM-Models/</text>
            <text x="44" y="68">RSC-AR-LOD350.ifc</text>
            <text x="44" y="82">RSC-ST-Rebar.rvt</text>
            <text x="30" y="96" fill="#cbd5e1">02-Shop-Drawings/</text>
            <text x="44" y="110">SHP-ST-01-Mat.dwg</text>
            <text x="44" y="124">SHP-AR-04-Wallpost.dwg</text>
            <text x="30" y="138" fill="#cbd5e1">03-BOQ-And-IPC/</text>
            <text x="44" y="152">BOQ-1405-Rev03.xlsx</text>
            <text x="44" y="166">IPC-02-Approved.pdf</text>
            <text x="30" y="180" fill="#cbd5e1">04-Site-QC-HSE/</text>
            <text x="44" y="193">RFI-CV-19 &amp; NCR-04.pdf</text>
          </g>

          {/* Blinking Cursor */}
          <rect className="anim-cursor-blink" x="186" y="184" width="5" height="10" fill="#d5b368" />
        </g>

        {/* SUB-PANEL 4B (RIGHT): Technical Submittals, RFI & NCR Table */}
        <g transform="translate(265, 34)">
          <rect x="0" y="0" width="375" height="200" strokeWidth="1.1" />
          <line x1="0" y1="32" x2="375" y2="32" strokeWidth="0.9" />
          <line x1="0" y1="74" x2="375" y2="74" strokeWidth="0.6" />
          <line x1="0" y1="116" x2="375" y2="116" strokeWidth="0.6" />
          <line x1="0" y1="158" x2="375" y2="158" strokeWidth="0.6" />

          <line x1="295" y1="0" x2="295" y2="200" strokeWidth="0.7" />
          <line x1="115" y1="0" x2="115" y2="200" strokeWidth="0.7" />

          {/* CDE Row Scanner */}
          <g className="anim-cde-scan">
            <rect x="1" y="33" width="373" height="40" fill="rgba(213, 179, 104, 0.08)" stroke="#d5b368" strokeWidth="0.8" />
          </g>

          <g fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" stroke="none">
            <text x="335" y="20" textAnchor="middle" fontWeight="600">شماره مدرک</text>
            <text x="205" y="20" textAnchor="middle" fontWeight="600">عنوان نقشه کارگاهی / مدرک فنی</text>
            <text x="57.5" y="20" textAnchor="middle" fontWeight="600">وضعیت ابلاغ</text>

            {/* Row 1 */}
            <text x="335" y="57" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8.5">SHP-ST-01</text>
            <text x="205" y="57" textAnchor="middle">نقشه کارگاهی آرماتوربندی فونداسیون</text>
            <text x="57.5" y="57" textAnchor="middle">ابلاغ جهت اجرا (IFC)</text>

            {/* Row 2 */}
            <text x="335" y="99" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8.5">RFI-CV-19</text>
            <text x="205" y="99" textAnchor="middle">درخواست استعلام فنی بازشوهای دال</text>
            <text x="57.5" y="99" textAnchor="middle">پاسخ مهندس مشاور</text>

            {/* Row 3 */}
            <text x="335" y="141" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8.5">NCR-QC-04</text>
            <text x="205" y="141" textAnchor="middle">گزارش عدم انطباق اسلامپ بتن و کیورینگ</text>
            <text x="57.5" y="141" textAnchor="middle">اصلاح‌شده (بسته)</text>

            {/* Row 4 */}
            <text x="335" y="183" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8.5">ASB-ME-02</text>
            <text x="205" y="183" textAnchor="middle">نقشه چون‌ساخت (As-Built) رایزر تأسیسات</text>
            <text x="57.5" y="183" textAnchor="middle">ثبت در آرشیو فنی</text>
          </g>
        </g>

        {/* Architectural Titleblock Stamp */}
        <rect x="0" y="248" width="640" height="82" strokeWidth="1.2" />
        <line x1="390" y1="248" x2="390" y2="330" strokeWidth="0.8" />
        <line x1="175" y1="248" x2="175" y2="330" strokeWidth="0.8" />
        <line x1="0" y1="289" x2="640" y2="289" strokeWidth="0.6" />

        <g fill="#94a3b8" fontFamily="Vazirmatn" fontSize="9.5" stroke="none">
          <text x="515" y="273" textAnchor="middle" fontWeight="700">کارفرما و مجری: رویال استار کانستراکشن (RSC)</text>
          <text x="515" y="314" textAnchor="middle">پرتال جامع متره و برآورد، دفتر فنی و کنترل پروژه</text>
          <text x="282.5" y="273" textAnchor="middle">سیستم مختصات: UTM-WGS84 | مقیاس ۱:۱۰۰</text>
          <text x="282.5" y="314" textAnchor="middle">واحد مالی پیمان: ریال ایران (شمسـی)</text>
          <text x="87.5" y="273" textAnchor="middle" fontFamily="JetBrains Mono">DWG NO: RSC-1405-01</text>
          <text x="87.5" y="314" textAnchor="middle" fontFamily="JetBrains Mono">REV: rsd0.4 | SHEET 01/01</text>
        </g>
      </g>
    </svg>
  );
}
