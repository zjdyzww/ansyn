import { Component, ElementRef, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { fromEvent, Observable } from 'rxjs';
import { getTimeFormat } from '@ansyn/map-facade';
import { IOverlaysState, MarkUpClass, selectHoveredOverlay } from '../../reducers/overlays.reducer';
import { overlayOverviewComponentConstants } from './overlay-overview.component.const';
import {
	ChangeOverlayPreviewRotationAction,
	DisplayOverlayFromStoreAction,
	OverlaysActionTypes,
	SetMarkUp
} from '../../actions/overlays.actions';
import { AutoSubscription, AutoSubscriptions } from 'auto-subscriptions';
import { takeWhile, tap } from 'rxjs/operators';
import { Actions, ofType } from '@ngrx/effects';
import { IOverlay } from '../../models/overlay.model';

export interface IOverviewOverlay extends IOverlay {
	thumbnailName: string;
}

@Component({
	selector: 'ansyn-overlay-overview',
	templateUrl: './overlay-overview.component.html',
	styleUrls: ['./overlay-overview.component.less']
})
@AutoSubscriptions({
	init: 'ngOnInit',
	destroy: 'ngOnDestroy'
})
export class OverlayOverviewComponent implements OnInit, OnDestroy {
	@ViewChild('img', {static:false}) img: ElementRef;

	public mouseLeave$: Observable<any> = fromEvent(this.el.nativeElement, 'mouseleave')
		.pipe(
			takeWhile(() => this.isHoveringOverDrop),
			tap(() => {
				this.store$.dispatch(SetMarkUp({
					classToSet: MarkUpClass.hover,
					dataToSet: { overlaysIds: [] }
				}));
			})
		);

	public sensorName: string;
	public sensorType: string;
	public formattedTime: string;
	public overlayId: string;
	public loadingImage = false;
	public rotation = 0;
	protected topElement = this.el.nativeElement.parentElement;

	get dropElement(): Element {
		return this.topElement.querySelector(`#dropId-${ this.overlayId }`);
	}

	public get const() {
		return overlayOverviewComponentConstants;
	}

	public get errorSrc() {
		return this.const.OVERLAY_OVERVIEW_FAILED;
	};

	@HostBinding('class.show') isHoveringOverDrop = false;
	@HostBinding('style.left.px') left = 0;
	@HostBinding('style.top.px') top = 0;

	@AutoSubscription
	rotationChanged$: Observable<any> = this.actions$.pipe(
		ofType(ChangeOverlayPreviewRotationAction),
		tap(payload => this.rotation = payload)
	);

	@AutoSubscription
	hoveredOverlay$: Observable<any> = this.store$.pipe(
		select(selectHoveredOverlay),
		tap(this.onHoveredOverlay.bind(this))
	);

	constructor(
		public store$: Store<IOverlaysState>,
		public actions$: Actions,
		protected el: ElementRef) {
	}

	ngOnInit() {
	}

	ngOnDestroy(): void {
	}

	onHoveredOverlay(overlay: IOverviewOverlay) {
		if (overlay) {
			const fetching = overlay.thumbnailUrl === this.const.FETCHING_OVERLAY_DATA;
			this.overlayId = overlay.id;
			const hoveredElement: Element = this.dropElement;
			if (!hoveredElement) {
				return;
			}
			const hoveredElementBounds: ClientRect = hoveredElement.getBoundingClientRect();
			this.left = this.getLeftPosition(hoveredElementBounds.left);
			this.top = hoveredElementBounds.top;
			this.showOverview();
			this.sensorName = overlay.sensorName;
			this.sensorType = overlay.sensorType;
			if (fetching) {
				this.img.nativeElement.removeAttribute('src');
			} else {
				this.img.nativeElement.src = overlay.thumbnailUrl;
			}
			this.formattedTime = getTimeFormat(new Date(overlay.photoTime));
			if (!this.img.nativeElement.complete) {
				this.startedLoadingImage();
			}
		} else {
			this.hideOverview();
		}
	}

	getLeftPosition(hoveredElementPos: number): number {
		const candidateLeftPos = hoveredElementPos - 50;
		const myCurrentWidth = (this.el.nativeElement as HTMLElement).offsetWidth;
		const ansynWidth = this.topElement.getBoundingClientRect().width;
		// ^ Ansyn component is not a block element, therefore it doesn't have offsetWidth
		// Therefore I used getBoundingClientRect()
		return Math.min(candidateLeftPos, ansynWidth - myCurrentWidth);
	}

	showOverview() {
		this.isHoveringOverDrop = true;
		this.mouseLeave$.subscribe();
	}

	hideOverview() {
		this.isHoveringOverDrop = false;
	}

	onDblClick() {
		this.store$.dispatch(DisplayOverlayFromStoreAction({ id: this.overlayId }));
	}

	startedLoadingImage() {
		this.loadingImage = true;
	}

	finishedLoadingImage() {
		this.loadingImage = false;
	}
}
