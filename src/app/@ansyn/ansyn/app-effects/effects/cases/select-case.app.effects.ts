import { Inject, Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Action, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import {
	SetFavoriteOverlaysAction,
	SetOverlaysScannedAreaDataAction,
	SetOverlaysTranslationDataAction,
	SetPresetOverlaysAction,
	SetRemovedOverlaysIdsAction,
	SetRemovedOverlaysVisibilityAction,
	UpdateOverlaysManualProcessArgs
} from '../../../modules/overlays/overlay-status/actions/overlay-status.actions';
import { IAppState } from '../../app.effects.module';
import { concatMap } from 'rxjs/operators';
import { SetActiveMapId, SetLayoutAction, SetMapsDataActionStore } from '@ansyn/map-facade';
import {
	BeginLayerCollectionLoadAction,
	UpdateSelectedLayersIds
} from '../../../modules/menu-items/layers-manager/actions/layers.actions';
import {
	CasesActionTypes,
	SelectCaseAction,
	SelectCaseSuccessAction,
	SetAutoSave
} from '../../../modules/menu-items/cases/actions/cases.actions';
import { casesConfig, CasesService } from '../../../modules/menu-items/cases/services/cases.service';
import { UpdateFacetsAction } from '../../../modules/filters/actions/filters.actions';
import {
	SetAnnotationMode,
	SetMeasureDistanceToolState,
} from '../../../modules/menu-items/tools/actions/tools.actions';
import { isFullOverlay } from '../../../modules/core/utils/overlays';
import { ICoreConfig } from '../../../modules/core/models/core.config.model';
import { CoreConfig } from '../../../modules/core/models/core.config';
import { SetMiscOverlays, SetOverlaysCriteriaAction } from '../../../modules/overlays/actions/overlays.actions';
import { ICase, ICaseMapState } from '../../../modules/menu-items/cases/models/case.model';
import { IOverlay } from '../../../modules/overlays/models/overlay.model';
import { mapValues } from 'lodash';
import { UUID } from 'angular2-uuid';
import { ICasesConfig } from '../../../modules/menu-items/cases/models/cases-config';
import { UpdateGeoFilterStatus } from '../../../modules/status-bar/actions/status-bar.actions';

@Injectable()
export class SelectCaseAppEffects {

	@Effect()
	selectCase$: Observable<any> = this.actions$.pipe(
		ofType<SelectCaseAction>(CasesActionTypes.SELECT_CASE),
		concatMap<any, any>(({ payload }: SelectCaseAction) => this.selectCaseActions(payload, this.coreConfig.noInitialSearch))
	);

	constructor(protected actions$: Actions,
				protected store$: Store<IAppState>,
				@Inject(CoreConfig) protected coreConfig: ICoreConfig,
				@Inject(casesConfig) public caseConfig: ICasesConfig,
				protected casesService: CasesService
	) {
	}

	selectCaseActions(payload: ICase, noInitialSearch: boolean): Action[] {
		const { state, autoSave } = payload;
		// status-bar
		const { overlaysManualProcessArgs, overlaysTranslationData, overlaysScannedAreaData } = state;
		// map
		const { data } = state.maps;
		// context
		const { favoriteOverlays, removedOverlaysIds, removedOverlaysVisibility, presetOverlays, region, dataInputFilters, miscOverlays } = state;
		let { time } = state;
		const { layout } = state.maps;

		if (!time) {
			time = this.casesService.defaultTime;
		}

		if (typeof time.from === 'string') {
			time.from = new Date(time.from);
		}
		if (typeof time.to === 'string') {
			time.to = new Date(time.to);
		}
		// layers
		const { activeLayersIds } = state.layers;
		// filters
		const { facets } = state;

		const selectCaseAction = [
			new SetMapsDataActionStore({ mapsList: data.map(this.parseMapData.bind(this)) }),
			new SetActiveMapId(state.maps.activeMapId),
			new SetLayoutAction(<any>layout),
			new SetOverlaysCriteriaAction({ time, region, dataInputFilters }, { noInitialSearch }),
			new UpdateGeoFilterStatus({active: false, type: region.type}),
			new SetFavoriteOverlaysAction(favoriteOverlays.map(this.parseOverlay.bind(this))),
			new SetPresetOverlaysAction((presetOverlays || []).map(this.parseOverlay.bind(this))),
			new SetMiscOverlays({ miscOverlays: mapValues(miscOverlays || {}, this.parseOverlay.bind(this)) }),
			new SetOverlaysTranslationDataAction(overlaysTranslationData),
			new SetOverlaysScannedAreaDataAction(overlaysScannedAreaData),
			new BeginLayerCollectionLoadAction({ caseId: payload.id }),
			new UpdateOverlaysManualProcessArgs({ override: true, data: overlaysManualProcessArgs }),
			new UpdateFacetsAction(facets),
			new UpdateSelectedLayersIds(activeLayersIds),
			new SetAutoSave(autoSave),
			new SetRemovedOverlaysIdsAction(removedOverlaysIds),
			new SetRemovedOverlaysVisibilityAction(removedOverlaysVisibility),
			new SetAnnotationMode(null),
			new SetMeasureDistanceToolState(false),
			new SelectCaseSuccessAction(payload)
		];

		return selectCaseAction;
	}

	parseMapData(map: ICaseMapState): ICaseMapState {
		if (map.data.overlay) {
			return { ...map, data: { ...map.data, overlay: this.parseOverlay(map.data.overlay) } };
		}
		return map;
	}

	parseOverlay(overlay: IOverlay): IOverlay {
		return isFullOverlay(overlay) ? { ...overlay, date: new Date(overlay.date) } : overlay;
	}
}
