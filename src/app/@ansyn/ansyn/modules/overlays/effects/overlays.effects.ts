import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, from, Observable } from 'rxjs';
import { catchError,  filter, map, mergeMap, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import {
	CheckTrianglesAction,
	DisplayOverlayAction,
	DisplayOverlayFailedAction,
	LoadOverlaysAction,
	LoadOverlaysSuccessAction,
	OverlaysActionTypes,
	RequestOverlayByIDFromBackendAction,
	SetMarkUp,
	SetOverlaysCriteriaAction,
	SetOverlaysStatusMessageAction,
	UpdateOverlaysCountAction
} from '../actions/overlays.actions';
import { IOverlay, IOverlaysCriteria, IOverlaysFetchData, RegionContainment } from '../models/overlay.model';
import { BackToWorldView } from '../overlay-status/actions/overlay-status.actions';
import { selectFavoriteOverlays, selectPresetOverlays } from '../overlay-status/reducers/overlay-status.reducer';
import {
	MarkUpClass,
	overlaysStateSelector,
	overlaysStatusMessages,
	selectDrops,
	selectOverlaysArray,
	selectOverlaysCriteria
} from '../reducers/overlays.reducer';
import { OverlaysService } from '../services/overlays.service';
import { rxPreventCrash } from '../../core/utils/rxjs/operators/rxPreventCrash';
import { getPolygonIntersectionRatio, isPointContainedInGeometry } from '@ansyn/imagery';
import { getErrorLogFromException } from '../../core/utils/logs/timer-logs';
import { LoggerService } from '../../core/services/logger.service';
import { AreaToCredentialsService } from "../../core/services/credentials/area-to-credentials.service";
import { CredentialsService, ICredentialsResponse } from "../../core/services/credentials/credentials.service";
import { SetDoesUserHaveCredentials } from "@ansyn/menu";

@Injectable()
export class OverlaysEffects {

	@Effect({ dispatch: false })
	setOverlaysContainedInRegionField$ = this.actions$.pipe(
		ofType(OverlaysActionTypes.SET_OVERLAYS_CRITERIA, OverlaysActionTypes.LOAD_OVERLAYS_SUCCESS),
		withLatestFrom(this.store$.select(selectOverlaysCriteria), this.store$.select(selectOverlaysArray)),
		filter(([action, criteria, overlays]: [any, IOverlaysCriteria, IOverlay[]]) => Boolean(overlays) && overlays.length > 0),
		tap(([action, criteria, overlays]: [any, IOverlaysCriteria, IOverlay[]]) => {
			overlays.forEach((overlay: IOverlay) => {
				try {
					if (criteria.region.type === 'Point') {
						const isContained = isPointContainedInGeometry(criteria.region, overlay.footprint);
						overlay.containedInSearchPolygon = isContained ? RegionContainment.contained : RegionContainment.notContained;
					} else {
						const ratio = getPolygonIntersectionRatio(criteria.region, overlay.footprint);
						if (!Boolean(ratio)) {
							overlay.containedInSearchPolygon = RegionContainment.notContained;
						} else if (ratio === 1) {
							overlay.containedInSearchPolygon = RegionContainment.contained;
						} else {
							overlay.containedInSearchPolygon = RegionContainment.intersect;
						}
					}
				} catch (e) {
					console.error('failed to calc overlay intersection ratio of ', overlay, ' error ', e);
					overlay.containedInSearchPolygon = RegionContainment.unknown;
				}
			});
		}),
		rxPreventCrash()
	);

	@Effect()
	setOverlaysCriteria$ = this.actions$.pipe(
		ofType<SetOverlaysCriteriaAction>(OverlaysActionTypes.SET_OVERLAYS_CRITERIA),
		filter(action => !(action.options && action.options.noInitialSearch)),
		withLatestFrom(this.store$.select(overlaysStateSelector)),
		map(([{ payload }, { overlaysCriteria }]) => new CheckTrianglesAction(overlaysCriteria)));

	userAuthorizedAreas$: Observable<any> = this.credentialsService.getCredentials().pipe(
		map((userCredentials: ICredentialsResponse) => userCredentials.authorizedAreas.map(
			area => area.Id
			)
		));

	@Effect()
	checkTrianglesBeforeSearch$ = this.actions$.pipe(
		ofType<CheckTrianglesAction>(OverlaysActionTypes.CHECK_TRIANGLES),
		switchMap((action: CheckTrianglesAction) => {
			return forkJoin([this.areaToCredentialsService.getAreaTriangles(action.payload.region), this.userAuthorizedAreas$]).pipe(
				mergeMap<any, any>(([trianglesOfArea, userAuthorizedAreas]: [any, any]) => {

					if (userAuthorizedAreas.some( area => trianglesOfArea.includes(area))) {
						return [new LoadOverlaysAction(action.payload),
							new SetDoesUserHaveCredentials(true)];
					}
					return [new LoadOverlaysSuccessAction([]),
						new SetOverlaysStatusMessageAction(this.translate.instant(overlaysStatusMessages.noPermissionsForArea)),
						new SetDoesUserHaveCredentials(false)];
				}),
				catchError( () => {
					return [new LoadOverlaysAction(action.payload),
						new SetDoesUserHaveCredentials(true)];
				})
			)
		})

	);

	@Effect()
	loadOverlays$: Observable<{} | LoadOverlaysSuccessAction> = this.actions$.pipe(
		ofType<LoadOverlaysAction>(OverlaysActionTypes.LOAD_OVERLAYS),
		switchMap((action: LoadOverlaysAction) => {
			if (action.payload.dataInputFilters.fullyChecked || action.payload.dataInputFilters.filters.length > 0) {
				return this.requestOverlays(action.payload);
			}
			else {
				return [new LoadOverlaysSuccessAction([])];
			}
		})
	);

	@Effect()
	onRequestOverlayByID$: Observable<any> = this.actions$.pipe(
		ofType<RequestOverlayByIDFromBackendAction>(OverlaysActionTypes.REQUEST_OVERLAY_FROM_BACKEND),
		mergeMap((action: RequestOverlayByIDFromBackendAction) => {
			return this.overlaysService.getOverlayById(action.payload.overlayId, action.payload.sourceType).pipe(
				map((overlay: IOverlay) => new DisplayOverlayAction({
					overlay,
					mapId: action.payload.mapId,
					forceFirstDisplay: true
				})),
				catchError((exception) => {
					const errMsg = getErrorLogFromException(exception, `Failed to get overlay id=${action.payload.overlayId} sourceType=${action.payload.sourceType}`);
					this.loggerService.error(errMsg, 'overlays', 'Overlay_By_ID');
					return from([
						new DisplayOverlayFailedAction({ id: action.payload.overlayId, mapId: action.payload.mapId }),
						new BackToWorldView({ mapId: action.payload.mapId })
					]);
				})
			);
		})
	);


	@Effect()
	setFavoriteOverlaysUpdateCase$: Observable<any> = this.store$.pipe(
		select(selectFavoriteOverlays),
		map((favoriteOverlays: IOverlay[]) => favoriteOverlays.map(overlay => overlay.id)),
		map((overlayIds) => new SetMarkUp({
				classToSet: MarkUpClass.favorites,
				dataToSet: {
					overlaysIds: overlayIds
				}
			}
		))
	);

	@Effect()
	setPresetOverlaysUpdateCase$: Observable<any> = this.store$.pipe(
		select(selectPresetOverlays),
		map((presetOverlays: IOverlay[]) => presetOverlays.map(overlay => overlay.id)),
		map((overlayIds) => new SetMarkUp({
				classToSet: MarkUpClass.presets,
				dataToSet: {
					overlaysIds: overlayIds
				}
			}
		))
	);

	@Effect()
	dropsCount$ = this.store$.select(selectDrops).pipe(
		filter(Boolean),
		map(drops => new UpdateOverlaysCountAction(drops.length)));


	constructor(protected actions$: Actions,
				protected store$: Store<any>,
				protected translate: TranslateService,
				protected overlaysService: OverlaysService,
				protected loggerService: LoggerService,
				protected credentialsService: CredentialsService,
				protected areaToCredentialsService: AreaToCredentialsService) {
	}

	private requestOverlays(criteria: IOverlaysCriteria) {
		return this.overlaysService.search(criteria).pipe(
			// We use translate.instant instead of withLatestFrom + translate.get
			// Because of a bug: sometimes when starting the app the withLatestFrom that was here did not return,
			// and the timeline was stuck and not updated. After this fix the pipe works, but once in a while the
			// translations that are called here fail, and return the keys instead.
			mergeMap<IOverlaysFetchData, any>((overlays: IOverlaysFetchData) => {
				const noOverlayMatchQuery = this.translate.instant(overlaysStatusMessages.noOverLayMatchQuery);
				const overLoad = this.translate.instant(overlaysStatusMessages.overLoad);
				const error = this.translate.instant('Error on overlays request');
				const overlaysResult = Array.isArray(overlays.data) ? overlays.data : [];

				if (!Array.isArray(overlays.data) && Array.isArray(overlays.errors) && overlays.errors.length >= 0) {
					return [new LoadOverlaysSuccessAction(overlaysResult),
						new SetOverlaysStatusMessageAction(error)];
				}

				const actions: Array<any> = [new LoadOverlaysSuccessAction(overlaysResult)];

				// if data.length != fetchLimit that means only duplicate overlays removed
				if (!overlays.data || overlays.data.length === 0) {
					actions.push(new SetOverlaysStatusMessageAction(noOverlayMatchQuery));
				} else if (overlays.limited > 0 && overlays.data.length === this.overlaysService.fetchLimit) {
					// TODO: replace when design is available
					actions.push(new SetOverlaysStatusMessageAction(overLoad.replace('$overLoad', overlays.data.length.toString())));
				}
				return actions;
			}),
			catchError(() => from([new LoadOverlaysSuccessAction([]), new SetOverlaysStatusMessageAction('Error on overlays request')]))
		);
	}

}
