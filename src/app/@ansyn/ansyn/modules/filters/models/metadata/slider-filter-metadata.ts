import { FilterMetadata } from './filter-metadata.interface';
import { FilterType } from '../filter-type';
import { ICaseFilter, ICaseSliderFilterMetadata } from '../../../menu-items/cases/models/case.model';
import { IOverlay } from '../../../overlays/models/overlay.model';

export class SliderFilterMetadata extends FilterMetadata {
	count = 0;
	filteredCount = 0;

	min: number = Number.MAX_SAFE_INTEGER;
	max: number = Number.MIN_SAFE_INTEGER;

	start = -Infinity;
	end = Infinity;

	type: FilterType = FilterType.Slider;

	updateMetadata(range: { start: number, end: number }): void {
		if (!range || (range.start && range.end && range.start > range.end)) {
			return;
		}

		this.start = range.start || -Infinity;
		this.end = range.end || Infinity;
	}

	accumulateData(value: number): void {
		if (value < this.min) {
			this.min = value;
		}

		if (value > this.max) {
			this.max = value;
		}
		this.count++;
	}

	hasResults(): boolean {
		return true;
	}

	incrementFilteredCount(value: number): void {
		this.filteredCount++;
	}

	resetFilteredCount(): void {
		this.filteredCount = 0;
	}

	initializeFilter(overlays: IOverlay[], modelName: string, caseFilter: ICaseFilter<ICaseSliderFilterMetadata>, visibility?: boolean): void {
		super.initializeFilter(overlays, modelName, caseFilter, visibility);
		this.count = 0;

		overlays.forEach((overlay: any) => {
			this.accumulateData(overlay[modelName]);
		});

		if (caseFilter) {
			this.updateMetadata(caseFilter.metadata);
		}
	}

	filterFunc(overlay: any, key: string): boolean {
		return overlay[key] >= this.start &&
			overlay[key] <= this.end;
	}

	getMetadataForOuterState(): ICaseSliderFilterMetadata {
		if (this.start === -Infinity && this.end === Infinity) {
			return null;
		}
		return { start: this.start, end: this.end };
	}

	isFiltered(): boolean {
		return this.start > this.min || this.end < this.max;
	}

	showAll(): void {
		this.start = -Infinity;
		this.end = Infinity;
	}

	shouldBeHidden(): boolean {
		return !this.visible || this.min === this.max;
	}
}
