import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type SwipeAdjustInputProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  className: string;
  min: number;
  max?: number;
  adjustmentStep: number;
  precision: number;
  inputMode: "decimal" | "numeric";
  placeholder?: string;
  testId: string;
};

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  distance: number;
  active: boolean;
  moved: boolean;
  cancelled: boolean;
  holdTimer: number;
};

const PIXELS_PER_STEP = 22;
const HOLD_TO_ADJUST_MS = 220;
const HOLD_SCALE = 1.035;

export function SwipeAdjustInput({
  id,
  value,
  onValueChange,
  className,
  min,
  max = Number.POSITIVE_INFINITY,
  adjustmentStep,
  precision,
  inputMode,
  placeholder,
  testId,
}: SwipeAdjustInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const valueRef = useRef(value);
  const animationRef = useRef<Animation | null>(null);
  const directionTimer = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => () => {
    window.clearTimeout(directionTimer.current ?? undefined);
    animationRef.current?.cancel();
  }, []);

  const endGesture = (event?: ReactPointerEvent<HTMLInputElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || (event && event.pointerId !== gesture.pointerId)) return;
    window.clearTimeout(gesture.holdTimer);
    gestureRef.current = null;
    animationRef.current?.cancel();
    animationRef.current = null;
    setActive(false);
    if (cancelled) return;
    if (!gesture.active && !gesture.moved && !gesture.cancelled) inputRef.current?.focus();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const input = event.currentTarget;
    const gesture: Gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      distance: 0,
      active: false,
      moved: false,
      cancelled: false,
      holdTimer: 0,
    };
    gestureRef.current = gesture;
    try {
      input.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and some embedded WebViews do not expose capture.
    }
    gesture.holdTimer = window.setTimeout(() => {
      if (gestureRef.current !== gesture || gesture.cancelled) return;
      gesture.active = true;
      setActive(true);
    }, HOLD_TO_ADJUST_MS);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLInputElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const deltaX = event.clientX - gesture.lastX;
    gesture.lastX = event.clientX;
    if (Math.abs(event.clientX - gesture.startX) > 8 || Math.abs(event.clientY - gesture.startY) > 8) {
      gesture.moved = true;
    }
    if (!gesture.active) {
      if (Math.abs(event.clientY - gesture.startY) > 12) {
        gesture.cancelled = true;
        window.clearTimeout(gesture.holdTimer);
      }
      return;
    }

    event.preventDefault();
    gesture.distance += deltaX;
    const steps = Math.trunc(gesture.distance / PIXELS_PER_STEP);
    if (steps === 0) return;
    gesture.distance -= steps * PIXELS_PER_STEP;

    const blank = valueRef.current.trim() === "";
    const current = blank ? min : Number(valueRef.current);
    const adjustedSteps = blank && min > 0 && steps > 0 ? steps - 1 : steps;
    const next = Math.min(
      max,
      Math.max(min, current + adjustedSteps * adjustmentStep),
    );
    if (!Number.isFinite(next) || next === current && !blank) return;

    const existingPrecision = valueRef.current.includes(".")
      ? valueRef.current.split(".")[1]?.length ?? 0
      : 0;
    const nextValue = String(Number(next.toFixed(Math.min(10, Math.max(precision, existingPrecision)))));
    valueRef.current = nextValue;
    onValueChange(nextValue);

    const changeDirection = Math.sign(steps) as -1 | 1;
    setDirection(changeDirection);
    window.clearTimeout(directionTimer.current ?? undefined);
    directionTimer.current = window.setTimeout(() => setDirection(0), 170);

    const restingScale = gesture.active ? HOLD_SCALE : 1;
    const peakScale = changeDirection > 0 ? 1.075 : 1.06;
    if (typeof inputRef.current?.animate === "function") {
      animationRef.current?.cancel();
      animationRef.current = inputRef.current.animate(
        [{ transform: `scale(${peakScale})` }, { transform: `scale(${restingScale})` }],
        { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  };

  const classes = [
    className,
    "origin-center touch-pan-y transition-[transform,color] duration-150 ease-out will-change-transform",
    active ? "scale-[1.035]" : "",
    active && direction > 0 ? "text-[hsl(var(--primary))]" : "",
    active && direction < 0 ? "text-[hsl(var(--muted-foreground))]" : "",
  ].filter(Boolean).join(" ");

  return <input
    ref={inputRef}
    id={id}
    type="number"
    min={min}
    max={Number.isFinite(max) ? max : undefined}
    step="any"
    inputMode={inputMode}
    value={value}
    placeholder={placeholder}
    className={classes}
    onChange={(event) => {
      valueRef.current = event.target.value;
      onValueChange(event.target.value);
    }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={(event) => endGesture(event)}
    onPointerCancel={(event) => endGesture(event, true)}
    data-adjust-direction={direction > 0 ? "increase" : direction < 0 ? "decrease" : "none"}
    data-testid={testId}
  />;
}
