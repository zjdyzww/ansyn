import { EMPTY, forkJoin, Observable, Observer, of, throwError } from 'rxjs';
import * as turf from '@turf/turf';
import * as GeoJSON from 'geojson';
import { Point } from 'geojson';
import { Actions, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import {
	areCoordinatesNumeric,
	BaseImageryPlugin,
	CommunicatorEntity,
	getAngleDegreeBetweenPoints,
	ImageryMapPosition,
	ImageryPlugin,
	toDegrees,
	toRadians
} from '@ansyn/imagery';
import { IStatusBarState, statusBarStateSelector } from '../../../../status-bar/reducers/status-bar.reducer';
import { MapActionTypes, PointToRealNorthAction, selectActiveMapId, selectMapPositionByMapId } from '@ansyn/map-facade';
import { AutoSubscription } from 'auto-subscriptions';
import { OpenLayersMap, OpenLayersProjectionService } from '@ansyn/ol';
import {
	catchError,
	debounceTime,
	filter,
	map,
	mergeMap,
	retry,
	switchMap,
	take,
	tap,
	withLatestFrom
} from 'rxjs/operators';

import OLMap from 'ol/Map';
import View from 'ol/View';
import { comboBoxesOptions } from '../../../../status-bar/models/combo-boxes.model';
import { LoggerService } from '../../../../core/services/logger.service';
import {
	ChangeOverlayPreviewRotationAction,
	DisplayOverlaySuccessAction,
	OverlaysActionTypes
} from '../../../../overlays/actions/overlays.actions';
import { selectHoveredOverlay } from '../../../../overlays/reducers/overlays.reducer';
import { CaseOrientation } from '../../../../menu-items/cases/models/case.model';
import { IOverlay } from '../../../../overlays/models/overlay.model';
import {
	BackToWorldSuccess,
	BackToWorldView,
	OverlayStatusActionsTypes
} from '../../../../overlays/overlay-status/actions/overlay-status.actions';

@ImageryPlugin({
	supported: [OpenLayersMap],
	deps: [Actions, LoggerService, Store, OpenLayersProjectionService]
})
export class NorthCalculationsPlugin extends BaseImageryPlugin {
	communicator: CommunicatorEntity;
	isEnabled = true;

	protected maximumNumberOfRetries = 10;
	protected thresholdDegrees = 0.1;

	shadowMapObject: OLMap;
	shadowMapObjectView: View;

	@AutoSubscription
	hoveredOverlayPreview$: Observable<any> = this.store$.select(selectHoveredOverlay).pipe(
		withLatestFrom(this.store$.pipe(select(selectActiveMapId))),
		filter(([overlay, activeMapId]: [IOverlay, string]) => Boolean(overlay) && Boolean(this.communicator) && activeMapId === this.mapId),
		mergeMap(([{ projection }]: [IOverlay, string]) => {
			const view = this.communicator.ActiveMap.mapObject.getView();
			const viewProjection = view.getProjection();
			const sourceProjectionCode = viewProjection.getCode();
			return this.getPreviewNorth(sourceProjectionCode, projection)
				.pipe(catchError(() => of(0)));
		}),
		tap((north: number) => {
			this.store$.dispatch(ChangeOverlayPreviewRotationAction({payload: -north}));
		})
	);

	@AutoSubscription
	pointToRealNorth$ = this.actions$.pipe(
		ofType(PointToRealNorthAction),
		filter(payload => payload.mapId === this.mapId),
		switchMap(payload => {
			return this.setActualNorth();
		})
	);

	@AutoSubscription
	calcNorthAfterDisplayOverlaySuccess$ = this.actions$.pipe(
		ofType(DisplayOverlaySuccessAction),
		filter(payload => payload.mapId === this.mapId),
		withLatestFrom(this.store$.select(statusBarStateSelector), ({ payload }: DisplayOverlaySuccessAction, { comboBoxesProperties }: IStatusBarState) => {
			return [payload.forceFirstDisplay, comboBoxesProperties.orientation, payload.overlay, payload.customOriantation];
		}),
		filter(([forceFirstDisplay, orientation, overlay, customOriantation]: [boolean, CaseOrientation, IOverlay, string]) => {
			return comboBoxesOptions.orientations.includes(orientation);
		}),
		switchMap(([forceFirstDisplay, orientation, overlay, customOriantation]: [boolean, CaseOrientation, IOverlay, string]) => {
			if (!forceFirstDisplay &&
				((orientation === 'Align North' && !Boolean(customOriantation)) || customOriantation === 'Align North')) {
				return this.setActualNorth();
			}
			// for 'Imagery Perspective' or 'User Perspective'
			return this.getVirtualNorth(this.iMap.mapObject).pipe(take(1)).pipe(
				tap((virtualNorth: number) => {
					this.communicator.setVirtualNorth(virtualNorth);

					if (!forceFirstDisplay && (orientation === 'Imagery Perspective' || customOriantation === 'Imagery Perspective')) {
						if (overlay.sensorLocation) {
							this.communicator.getCenter().pipe(take(1)).subscribe(point => {
								const brng = getAngleDegreeBetweenPoints(overlay.sensorLocation, point);
								const resultBearings = 360 - (brng + toDegrees(-this.communicator.getVirtualNorth()));
								this.communicator.setRotation(toRadians(resultBearings));
							});
						} else {
							this.communicator.setRotation(overlay.azimuth);
						}
					}
					// if 'User Perspective' do nothing
				}));
		})
	);

	@AutoSubscription
	backToWorldSuccessSetNorth$ = this.actions$.pipe(
		ofType(BackToWorldSuccess),
		filter(payload => payload.mapId === this.communicator.id),
		withLatestFrom(this.store$.select(statusBarStateSelector)),
		tap(([action, { comboBoxesProperties }]: [BackToWorldView, IStatusBarState]) => {
			this.communicator.setVirtualNorth(0);
			switch (comboBoxesProperties.orientation) {
				case 'Align North':
				case 'Imagery Perspective':
					this.communicator.setRotation(0);
			}
		})
	);

	@AutoSubscription
	positionChangedCalcNorthAccurately$ = () => this.store$.select(selectMapPositionByMapId(this.mapId)).pipe(
		debounceTime(50),
		filter(Boolean),
		switchMap((position: ImageryMapPosition) => {
			const view = this.iMap.mapObject.getView();
			const projection = view.getProjection();
			if (projection.getUnits() === 'pixels' && position) {
				if (!position.projectedState) {
					return of(0);
				}

				return this.pointNorth(this.shadowMapObject).pipe(take(1)).pipe(
					map((calculatedNorthAngleAfterPointingNorth: number) => {
						const shRotation = this.shadowMapObjectView.getRotation();
						let currentRotationDegrees = toDegrees(shRotation);
						if (currentRotationDegrees < 0) {
							currentRotationDegrees = 360 + currentRotationDegrees;
						}
						currentRotationDegrees = currentRotationDegrees % 360;
						return toRadians(currentRotationDegrees);
					}),
					catchError((error) => of(0)) // prevent's subscriber disappearance
				);
			}
			return of(0);
		}),
		tap((virtualNorth: number) => {
			this.communicator.setVirtualNorth(virtualNorth);
		})
	);

	constructor(protected actions$: Actions,
				public loggerService: LoggerService,
				public store$: Store<any>,
				protected projectionService: OpenLayersProjectionService) {
		super();
	}

	setActualNorth(): Observable<any> {
		return this.pointNorth(this.shadowMapObject).pipe(take(1)).pipe(
			tap((virtualNorth: number) => {
				this.communicator.setVirtualNorth(virtualNorth);
				this.communicator.setRotation(virtualNorth);
			}),
			catchError(reason => {
				return EMPTY;
			})
		);
	}

	pointNorth(mapObject: OLMap): Observable<any> {
		mapObject.updateSize();
		mapObject.renderSync();
		return this.getCorrectedNorth(mapObject).pipe(
			catchError(reason => {
				const error = `setCorrectedNorth failed ${ reason }`;
				this.loggerService.warn(error, 'map', 'north_plugin');
				return throwError(error);
			})
		);
	}

	getCorrectedNorth(mapObject: OLMap): Observable<any> {
		return this.getProjectedCenters(mapObject).pipe(
			map((projectedCenters: Point[]): any => {
				const projectedCenterView = projectedCenters[0].coordinates;
				const projectedCenterViewWithoffset = projectedCenters[1].coordinates;
				const northOffsetRad = Math.atan2((projectedCenterViewWithoffset[0] - projectedCenterView[0]), (projectedCenterViewWithoffset[1] - projectedCenterView[1]));

				const northOffsetDeg = toDegrees(northOffsetRad);
				const view = mapObject.getView();
				const actualNorth = northOffsetRad + view.getRotation();
				return { northOffsetRad, northOffsetDeg, actualNorth };
			}),
			mergeMap((northData) => {
				const view = mapObject.getView();
				view.setRotation(northData.actualNorth);
				mapObject.renderSync();
				if (Math.abs(northData.northOffsetDeg) > this.thresholdDegrees) {
					return throwError({ result: northData.actualNorth });
				}
				return of(northData.actualNorth);
			}),
			retry(this.maximumNumberOfRetries),
			catchError((e) => e.result ? of(e.result) : throwError(e))
		);
	}

	getPreviewNorth(sourceProjection: string, destProjection: string) {
		const mapObject = this.iMap.mapObject;
		return this.getProjectedCenters(mapObject, sourceProjection, destProjection).pipe(
			map((projectedCenters: Point[]): number => {
				const projectedCenterView = projectedCenters[0].coordinates;
				const projectedCenterViewWithOffset = projectedCenters[1].coordinates;
				const northOffsetRad = Math.atan2((projectedCenterViewWithOffset[0] - projectedCenterView[0]), (projectedCenterViewWithOffset[1] - projectedCenterView[1]));
				return northOffsetRad;
			})
		);
	}

	getVirtualNorth(mapObject: OLMap, sourceProjection?: string, destProjection?: string) {
		return this.getProjectedCenters(mapObject, sourceProjection, destProjection).pipe(
			map((projectedCenters: Point[]): number => {
				const projectedCenterView = projectedCenters[0].coordinates;
				const projectedCenterViewWithOffset = projectedCenters[1].coordinates;
				const northOffsetRad = Math.atan2((projectedCenterViewWithOffset[0] - projectedCenterView[0]), (projectedCenterViewWithOffset[1] - projectedCenterView[1]));
				const northRad = northOffsetRad * -1;
				const communicatorRad = this.communicator.getRotation();
				let currentRotationDegrees = toDegrees(communicatorRad);
				if (currentRotationDegrees < 0) {
					currentRotationDegrees = 360 + currentRotationDegrees;
				}
				currentRotationDegrees = currentRotationDegrees % 360;
				let northDeg = toDegrees(northRad);
				if (northDeg < 0) {
					northDeg = 360 + northDeg;
				}
				northDeg = northDeg % 360;
				if (this.thresholdDegrees > Math.abs(currentRotationDegrees - northDeg)) {
					return 0;
				}
				return (this.communicator.getRotation() - northRad) % (Math.PI * 2);
			}),
			catchError(() => of(0))
		);
	}

	projectPoints(coordinates: [number, number][], sourceProjection: string, destProjection: string): Observable<Point[] | any> {
		return forkJoin(coordinates.map((coordinate) => {
			const point = <GeoJSON.Point>turf.geometry('Point', coordinate);
			if (sourceProjection && destProjection) {
				return this.projectionService.projectApproximatelyFromProjection(point, sourceProjection, destProjection);
			}
			return this.projectionService.projectAccurately(point, this.iMap.mapObject);
		}));
	}

	getProjectedCenters(mapObject: OLMap, sourceProjection?: string, destProjection?: string): Observable<Point[]> {
		return Observable.create((observer: Observer<any>) => {
			const size = mapObject.getSize();
			const olCenterView = mapObject.getCoordinateFromPixel([size[0] / 2, size[1] / 2]);
			if (!areCoordinatesNumeric(olCenterView)) {
				observer.error('no coordinate for pixel');
			}
			const olCenterViewWithOffset = mapObject.getCoordinateFromPixel([size[0] / 2, (size[1] / 2) - 1]);
			if (!areCoordinatesNumeric(olCenterViewWithOffset)) {
				observer.error('no coordinate for pixel');
			}
			observer.next([olCenterView, olCenterViewWithOffset]);
		})
			.pipe(switchMap((centers: [number, number][]) => this.projectPoints(centers, sourceProjection, destProjection)));
	}

	onInit() {
		super.onInit();
		this.createShadowMap();
	}

	createShadowMap() {
		if (!this.shadowMapObject) {
			this.createShadowMapObject();
		}
		const view = this.communicator.ActiveMap.mapObject.getView();
		const projectedState = {
			...(<any>view).getState(),
			center: (<any>view).getCenter()
		};
		this.resetShadowMapView(projectedState);
	}

	onResetView(): Observable<boolean> {
		this.createShadowMap();
		return of(true);
	};

	createShadowMapObject() {
		const renderer = 'canvas';
		this.shadowMapObject = new OLMap({
			target: (<any>this.iMap).shadowNorthElement,
			renderer,
			controls: []
		});
	}

	resetShadowMapView(projectedState) {
		const layers = this.shadowMapObject.getLayers();
		layers.forEach((layer) => {
			this.shadowMapObject.removeLayer(layer);
		});
		const mainLayer = this.iMap.getMainLayer();
		this.shadowMapObjectView = new View({
			projection: mainLayer.getSource().getProjection()
		});
		this.shadowMapObject.addLayer(mainLayer);
		this.shadowMapObject.setView(this.shadowMapObjectView);

		const { center, zoom, rotation } = projectedState;
		this.shadowMapObjectView.setCenter(center);
		this.shadowMapObjectView.setZoom(zoom);
		this.shadowMapObjectView.setRotation(rotation);
	}
}
