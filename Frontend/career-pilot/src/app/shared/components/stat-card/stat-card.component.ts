import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

const COUNT_UP_DURATION_MS = 700;

// Ease-out cubic - starts fast, settles gently into the final number rather than a linear tick-up.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

@Component({
  selector: 'app-stat-card',
  standalone: true,
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly accent = input<'blue' | 'purple' | 'green' | 'red' | 'amber'>('blue');

  // What the template actually renders. Mirrors `value()` immediately for a string (nothing to
  // animate), but for a number it's driven by requestAnimationFrame counting up from whatever it
  // last displayed - including from 0 the first time a value ever arrives.
  readonly displayValue = signal<number | string>(0);

  private animationFrameId: number | null = null;
  private previousNumericValue = 0;

  constructor() {
    effect(() => {
      const target = this.value();

      if (typeof target !== 'number') {
        this.cancelAnimation();
        this.displayValue.set(target);
        return;
      }

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        this.previousNumericValue = target;
        this.displayValue.set(target);
        return;
      }

      this.animateTo(target);
    });
  }

  private animateTo(target: number): void {
    this.cancelAnimation();

    const start = this.previousNumericValue;
    const delta = target - start;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const current = Math.round(start + delta * easeOutCubic(progress));
      this.displayValue.set(current);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.previousNumericValue = target;
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  private cancelAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
