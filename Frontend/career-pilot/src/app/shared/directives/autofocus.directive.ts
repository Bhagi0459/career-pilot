import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * Focuses the host element once it renders. Used on the first field of
 * auth/CRUD forms so keyboard-first users can start typing immediately.
 */
@Directive({
  selector: '[appAutofocus]',
  standalone: true
})
export class AutofocusDirective implements AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    this.elementRef.nativeElement.focus();
  }
}
