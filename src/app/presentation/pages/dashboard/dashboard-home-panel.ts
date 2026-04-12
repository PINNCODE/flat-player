import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, QueryList, ViewChild, ViewChildren, computed, input } from '@angular/core';
import { HomeRecommendations } from '@core/domain/models/home-recommendations.model';

@Component({
  selector: 'app-dashboard-home-panel',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-home-panel.html',
  styleUrl: './dashboard-home-panel.scss',
})
export class DashboardHomePanel {
  readonly homeRecommendations = input<HomeRecommendations | null>(null);
  readonly focusedRowIndex = input.required<number>();
  readonly focusedItemIndex = input.required<number>();

  @ViewChild('homeRowsContainer') private homeRowsContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren('homeRowItem') private homeRowItems?: QueryList<ElementRef<HTMLDivElement>>;

  protected readonly rows = computed(() => this.homeRecommendations()?.rows ?? []);

  protected isFocused(rowIndex: number, itemIndex: number): boolean {
    return this.focusedRowIndex() === rowIndex && this.focusedItemIndex() === itemIndex;
  }

  protected rowOffset(rowIndex: number): string {
    if (this.focusedRowIndex() !== rowIndex) {
      return 'none';
    }

    return `translateX(${-this.focusedItemIndex() * 220}px)`;
  }

  scrollRowsToTop(): void {
    const container = this.homeRowsContainer?.nativeElement;
    if (!container) {
      return;
    }

    container.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollRowIntoView(rowIndex: number): void {
    const container = this.homeRowsContainer?.nativeElement;
    if (!container || rowIndex < 0) {
      return;
    }

    const rowElement = this.homeRowItems?.get(rowIndex)?.nativeElement;
    if (!rowElement) {
      return;
    }

    const rowTop = rowElement.offsetTop;
    const rowBottom = rowTop + rowElement.offsetHeight;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;
    const padding = 12;

    if (rowTop - padding < viewportTop) {
      container.scrollTo({ top: Math.max(0, rowTop - padding), behavior: 'smooth' });
      return;
    }

    if (rowBottom + padding > viewportBottom) {
      container.scrollTo({ top: rowBottom - container.clientHeight + padding, behavior: 'smooth' });
    }
  }
}
