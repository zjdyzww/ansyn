import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { selectPresetOverlays } from '../../modules/overlays/overlay-status/reducers/overlay-status.reducer';
import { IAppState } from '../app.effects.module';
import { casesStateSelector, ICasesState } from '../../modules/menu-items/cases/reducers/cases.reducer';
import {
	ClickOutsideMap,
	ContextMenuShowAction,
	MapActionTypes,
	selectActiveMapId,
	selectOverlayOfActiveMap
} from '@ansyn/map-facade';
import { filter, map, tap, withLatestFrom } from 'rxjs/operators';
import {
	CopySnapshotShareLinkAction,
	GoAdjacentOverlay,
	GoNextPresetOverlay,
	StatusBarActionsTypes,
	UpdateGeoFilterStatus
} from '../../modules/status-bar/actions/status-bar.actions';
import { selectGeoFilterActive } from '../../modules/status-bar/reducers/status-bar.reducer';
import { CopyCaseLinkAction } from '../../modules/menu-items/cases/actions/cases.actions';
import { DisplayOverlayAction, DisplayOverlayFromStoreAction } from '../../modules/overlays/actions/overlays.actions';
import {
	selectDropsWithoutSpecialObjects,
	selectRegion
} from '../../modules/overlays/reducers/overlays.reducer';
import { IOverlay, IOverlayDrop } from '../../modules/overlays/models/overlay.model';
import { LoggerService } from '../../modules/core/services/logger.service';

@Injectable()
export class StatusBarAppEffects {

	@Effect({ dispatch: false })
	actionsLogger$: Observable<any> = this.actions$.pipe(
		ofType(
			StatusBarActionsTypes.COPY_SNAPSHOT_SHARE_LINK,
			StatusBarActionsTypes.GO_ADJACENT_OVERLAY,
			StatusBarActionsTypes.SET_IMAGE_OPENING_ORIENTATION
		),
		tap((action) => {
			this.loggerService.info(action.payload ? JSON.stringify(action.payload) : '', 'Status_Bar', action.type);
		}));

	@Effect()
	onAdjacentOverlay$: Observable<any> = this.actions$.pipe(
		ofType<GoAdjacentOverlay>(StatusBarActionsTypes.GO_ADJACENT_OVERLAY),
		withLatestFrom(this.store.select(selectOverlayOfActiveMap)),
		filter(( [action, overlay] ) => Boolean(overlay)),
		withLatestFrom(this.store.select(selectDropsWithoutSpecialObjects), ([ action, {id: overlayId} ], drops: IOverlayDrop[]): IOverlayDrop => {
			const index = drops.findIndex(({ id }) => id === overlayId);
			const isNextOverlay = action.payload.isNext;
			const adjacent = isNextOverlay ? 1 : -1;
			return drops[index + adjacent];
		}),
		filter(Boolean),
		map(({ id }) => new DisplayOverlayFromStoreAction({ id })));


	@Effect()
	onNextPresetOverlay$: Observable<any> = this.actions$.pipe(
		ofType<GoNextPresetOverlay>(StatusBarActionsTypes.GO_NEXT_PRESET_OVERLAY),
		withLatestFrom(this.store.select(selectOverlayOfActiveMap), this.store.select(selectActiveMapId), (Action, overlay: IOverlay, activeMapId: string): { overlayId: string, mapId: string } => {
			return { overlayId: overlay && overlay.id, mapId: activeMapId };
		}),
		withLatestFrom(this.store.select(selectPresetOverlays), ({ overlayId, mapId }, presetOverlays): { overlay: IOverlay, mapId: string } => {
			const length = presetOverlays.length;
			if (length === 0) {
				return;
			}
			const index = presetOverlays.findIndex(overlay => overlay.id === overlayId);
			const nextIndex = index === -1 ? 0 : index >= length - 1 ? 0 : index + 1;
			return { overlay: presetOverlays[nextIndex], mapId };
		}),
		filter(Boolean),
		map(({ overlay, mapId }) => new DisplayOverlayAction({ overlay, mapId }))
	);

	@Effect()
	onCopySelectedCaseLink$ = this.actions$.pipe(
		ofType<CopySnapshotShareLinkAction>(StatusBarActionsTypes.COPY_SNAPSHOT_SHARE_LINK),
		withLatestFrom(this.store.select(casesStateSelector), (action: CopySnapshotShareLinkAction, state: ICasesState) => {
			return state.selectedCase.id;
		}),
		map((caseId: string) => {
			return new CopyCaseLinkAction({ caseId: caseId, shareCaseAsQueryParams: true });
		})
	);


	@Effect({ dispatch: false })
	onExpand$: Observable<void> = this.actions$.pipe(
		ofType(StatusBarActionsTypes.EXPAND),
		map(() => {
			console.log('onExpand$');
		})
	);

	@Effect()
	onClickOutsideMap$ = this.actions$.pipe(
		ofType<ClickOutsideMap | ContextMenuShowAction>(MapActionTypes.TRIGGER.CLICK_OUTSIDE_MAP, MapActionTypes.CONTEXT_MENU.SHOW),
		withLatestFrom(this.store.select(selectGeoFilterActive)),
		filter(([action, active]) => active),
		map(([action, active]) => new UpdateGeoFilterStatus())
	);

	@Effect()
	onCancelGeoFilter$ = this.actions$.pipe(
		ofType<UpdateGeoFilterStatus>(StatusBarActionsTypes.UPDATE_GEO_FILTER_STATUS),
		filter(action => action.payload === undefined),
		withLatestFrom(this.store.select(selectRegion)),
		map( ([action , {type}]) => new UpdateGeoFilterStatus({type, active: false}))
	);

	constructor(protected actions$: Actions,
				protected store: Store<IAppState>,
				protected loggerService: LoggerService) {
	}

}
