// ===========================================
// Material 3 Style Clock Time Picker Component
// ===========================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, Keyboard, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ClockTimePickerProps {
  value?: string; // Format "HH:mm" (24h)
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

// Helpers
function parse24to12(time24 = '09:00'): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  // Desestructurar un `split` da `string | undefined` en cada posición: si llega
  // un valor mal formado (por ejemplo "9", sin los minutos) `mStr` no existe.
  // Los defaults dejan que el `|| 0` de abajo siga siendo la red de contención.
  const [hStr = '', mStr = ''] = time24.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}

function format12to24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12;
  if (period === 'AM') {
    h = hour12 === 12 ? 0 : hour12;
  } else {
    h = hour12 === 12 ? 12 : hour12 + 12;
  }
  const hStr = h.toString().padStart(2, '0');
  const mStr = minute.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}

export function ClockTimePickerModal({
  open,
  onOpenChange,
  value = '09:00',
  onSelectTime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  onSelectTime: (time24: string) => void;
}) {
  const initial = parse24to12(value);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  // Sync with value prop when opening
  useEffect(() => {
    if (open) {
      const parsed = parse24to12(value);
      setHour12(parsed.hour12);
      setMinute(parsed.minute);
      setPeriod(parsed.period);
      setMode('hours');
      setIsKeyboardMode(false);
    }
  }, [open, value]);

  const clockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const x = clientX - rect.left - cx;
      const y = clientY - rect.top - cy;

      // Calculate angle: 0 rad at 3 o'clock, clockwise in screen coords
      let angle = Math.atan2(y, x) * (180 / Math.PI); // -180 to 180
      // Rotate so 12 o'clock is 0 deg (clock top)
      angle = (angle + 90 + 360) % 360; // 0 to 360 deg

      if (mode === 'hours') {
        let h = Math.round(angle / 30);
        if (h === 0) h = 12;
        setHour12(h);
      } else {
        let m = Math.round(angle / 6) % 60;
        setMinute(m);
      }
    },
    [mode]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    calculateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      calculateFromPointer(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      if (mode === 'hours') {
        // Auto-switch to minutes mode smoothly
        setTimeout(() => setMode('minutes'), 180);
      }
    }
  };

  const handleConfirm = () => {
    const time24 = format12to24(hour12, minute, period);
    onSelectTime(time24);
    onOpenChange(false);
  };

  // Clock Geometry: 240px diameter, 90px radius
  const CLOCK_RADIUS = 90;
  const CENTER = 120;

  // Selected angle for clock hand
  const currentAngle = mode === 'hours' ? (hour12 % 12) * 30 : minute * 6;

  // Hand position
  const handAngleRad = ((currentAngle - 90) * Math.PI) / 180;
  const handTipX = CENTER + CLOCK_RADIUS * Math.cos(handAngleRad);
  const handTipY = CENTER + CLOCK_RADIUS * Math.sin(handAngleRad);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px] p-5 rounded-3xl bg-surface border border-primary-200 shadow-2xl space-y-4">
        <DialogHeader className="p-0 space-y-0 text-left">
          <DialogTitle className="text-xs font-bold uppercase tracking-wider text-primary-700">
            Seleccionar hora
          </DialogTitle>
        </DialogHeader>

        {/* Top Digital Display & AM/PM Switcher */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Big Time Display */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {/* Hours Box */}
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`w-20 h-18 rounded-2xl flex items-center justify-center text-3xl font-extrabold transition-all cursor-pointer select-none ${
                mode === 'hours'
                  ? 'bg-primary-600 text-white shadow-md scale-105 ring-2 ring-primary-300'
                  : 'bg-primary-100/70 text-primary-950 hover:bg-primary-200/80'
              }`}
            >
              {hour12.toString().padStart(2, '0')}
            </button>

            <span className="text-3xl font-bold text-primary-400 select-none">:</span>

            {/* Minutes Box */}
            <button
              type="button"
              onClick={() => setMode('minutes')}
              className={`w-20 h-18 rounded-2xl flex items-center justify-center text-3xl font-extrabold transition-all cursor-pointer select-none ${
                mode === 'minutes'
                  ? 'bg-primary-600 text-white shadow-md scale-105 ring-2 ring-primary-300'
                  : 'bg-primary-100/70 text-primary-950 hover:bg-primary-200/80'
              }`}
            >
              {minute.toString().padStart(2, '0')}
            </button>
          </div>

          {/* AM / PM Toggle Box */}
          <div className="flex flex-col rounded-xl border border-primary-200 overflow-hidden bg-white shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setPeriod('AM')}
              className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer select-none ${
                period === 'AM'
                  ? 'bg-accent-500 text-white'
                  : 'text-primary-700 hover:bg-primary-50'
              }`}
            >
              AM
            </button>
            <div className="h-[1px] bg-primary-100" />
            <button
              type="button"
              onClick={() => setPeriod('PM')}
              className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer select-none ${
                period === 'PM'
                  ? 'bg-accent-500 text-white'
                  : 'text-primary-700 hover:bg-primary-50'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Dial or Keyboard Mode */}
        {!isKeyboardMode ? (
          <div className="flex justify-center items-center py-2">
            <div
              ref={clockRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-[240px] h-[240px] rounded-full bg-primary-50/80 border border-primary-200/80 shadow-inner select-none touch-none cursor-pointer"
            >
              {/* Center Pivot Dot */}
              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-primary-700 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                style={{ left: `${CENTER}px`, top: `${CENTER}px` }}
              />

              {/* Hand Line (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={handTipX}
                  y2={handTipY}
                  stroke="#0a468c"
                  strokeWidth="2"
                />
              </svg>

              {/* Hand Tip Circle */}
              <div
                className="absolute w-9 h-9 rounded-full bg-primary-600 shadow-md flex items-center justify-center text-white font-bold text-sm -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none transition-transform"
                style={{ left: `${handTipX}px`, top: `${handTipY}px` }}
              >
                {mode === 'hours' ? hour12 : minute.toString().padStart(2, '0')}
              </div>

              {/* Dial Numbers: Hours (1-12) or Minutes (0-55 by 5s) */}
              {mode === 'hours'
                ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
                    const angleRad = ((h * 30 - 90) * Math.PI) / 180;
                    const x = CENTER + CLOCK_RADIUS * Math.cos(angleRad);
                    const y = CENTER + CLOCK_RADIUS * Math.sin(angleRad);
                    const isSelected = hour12 === h;

                    return (
                      <div
                        key={h}
                        className={`absolute w-7 h-7 flex items-center justify-center text-sm font-semibold rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                          isSelected ? 'text-white font-bold' : 'text-primary-900'
                        }`}
                        style={{ left: `${x}px`, top: `${y}px` }}
                      >
                        {h}
                      </div>
                    );
                  })
                : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                    const angleRad = ((m * 6 - 90) * Math.PI) / 180;
                    const x = CENTER + CLOCK_RADIUS * Math.cos(angleRad);
                    const y = CENTER + CLOCK_RADIUS * Math.sin(angleRad);
                    const isSelected = minute === m;

                    return (
                      <div
                        key={m}
                        className={`absolute w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                          isSelected ? 'text-white font-bold' : 'text-primary-800'
                        }`}
                        style={{ left: `${x}px`, top: `${y}px` }}
                      >
                        {m.toString().padStart(2, '0')}
                      </div>
                    );
                  })}
            </div>
          </div>
        ) : (
          /* Keyboard Numeric Mode */
          <div className="py-6 px-4 bg-white rounded-2xl border border-primary-200 space-y-4">
            <p className="text-xs text-primary-600 text-center font-medium">
              Ingresa la hora manualmente (12 horas + AM/PM):
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={hour12}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= 12) setHour12(val);
                  }}
                  className="w-16 h-12 text-center text-2xl font-bold rounded-xl border border-primary-300 bg-primary-50 text-primary-950 focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-[10px] text-primary-500 block mt-1">Hora (1-12)</span>
              </div>

              <span className="text-2xl font-bold text-primary-400">:</span>

              <div className="text-center">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minute.toString().padStart(2, '0')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 0 && val <= 59) setMinute(val);
                  }}
                  className="w-16 h-12 text-center text-2xl font-bold rounded-xl border border-primary-300 bg-primary-50 text-primary-950 focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-[10px] text-primary-500 block mt-1">Min (0-59)</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-primary-100">
          <button
            type="button"
            onClick={() => setIsKeyboardMode(!isKeyboardMode)}
            title={isKeyboardMode ? 'Cambiar a reloj circular' : 'Escribir con teclado'}
            className="p-2 rounded-full text-primary-600 hover:bg-primary-100 active:bg-primary-200 transition-colors cursor-pointer"
          >
            {isKeyboardMode ? <Clock className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold text-primary-700"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="text-xs font-bold gap-1 bg-primary-600 hover:bg-primary-700"
            >
              <Check className="w-3.5 h-3.5" />
              Aceptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Interactive Input Field Trigger
export function ClockTimePicker({
  value = '09:00',
  onChange,
  disabled = false,
}: ClockTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Compute pretty display label: "08:00 hs (08:00 PM)" or "20:00 hs"
  const { hour12, minute, period } = parse24to12(value);
  const pretty12 = `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`w-full h-11 flex items-center justify-between px-3 rounded-lg border border-primary-200 bg-white hover:border-primary-400 hover:bg-primary-50/50 active:bg-primary-100/60 shadow-2xs transition-all text-left group cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary-100 group-hover:bg-primary-200 flex items-center justify-center text-primary-700 transition-colors shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-primary-950 leading-tight">
                {value || '09:00'} hs
              </span>
              <span className="text-[11px] text-primary-500 font-medium">
                ({pretty12})
              </span>
            </div>
          </div>
        </div>

        <span className="text-xs font-semibold text-primary-600 bg-primary-50 group-hover:bg-primary-100 px-2 py-1 rounded-md transition-colors border border-primary-200/60 shrink-0">
          Cambiar
        </span>
      </button>

      <ClockTimePickerModal
        open={isOpen}
        onOpenChange={setIsOpen}
        value={value}
        onSelectTime={onChange}
      />
    </>
  );
}
