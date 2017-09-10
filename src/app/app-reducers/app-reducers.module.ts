import { FiltersAppEffects } from './effects/filters.app.effects';
import { IFiltersState, FiltersReducer } from '@ansyn/menu-items/filters';
import { LayersReducer } from '@ansyn/menu-items/layers-manager/reducers/layers.reducer';
import { LayersAppEffects } from './effects/layers.app.effects';
import { OverlayReducer } from '@ansyn/overlays';
import { CasesReducer } from '@ansyn/menu-items/cases/reducers/cases.reducer';
import { compose } from '@ngrx/core/compose';
import { combineReducers, StoreModule } from '@ngrx/store';
import { MenuReducer } from '@ansyn/menu/reducers/menu.reducer';
import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { MapAppEffects } from './effects/map.app.effects';
import { CasesAppEffects } from './effects/cases.app.effects';
import { MapReducer } from '@ansyn/map-facade/reducers/map.reducer';
import { MenuAppEffects } from './effects/menu.app.effects';
import { StatusBarReducer } from '@ansyn/status-bar/reducers/status-bar.reducer';
import { StatusBarAppEffects } from './effects/status-bar.app.effects';
import { IOverlayState } from '@ansyn/overlays/reducers/overlays.reducer';
import { ICasesState } from '@ansyn/menu-items/cases/reducers/cases.reducer';
import { IMenuState } from '@ansyn/menu/reducers/menu.reducer';
import { ILayerState } from '@ansyn/menu-items/layers-manager/reducers/layers.reducer';
import { IStatusBarState } from '@ansyn/status-bar/reducers/status-bar.reducer';
import { IMapState } from '@ansyn/map-facade/reducers/map.reducer';
import { IToolsState,ToolsReducer } from '@ansyn/menu-items/tools';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { OverlaysAppEffects } from './effects/overlays.app.effects';
import { ToolsAppEffects } from './effects/tools.app.effects';
import { ContextMenuAppEffects } from './effects/map/context-menu.app.effects';
import { ContextEntityAppEffects } from './effects/context/context-entity.app.effect';
import { VisualizersAppEffects } from './effects/map/visualizers.app.effects';
import { RouterReducer } from '@ansyn/router/reducers/router.reducer';
import { CasesRouterModule } from '@ansyn/cases-router/cases-router.module';
import { IRouterState } from '@ansyn/router/reducers/router.reducer';


export interface IAppState {
    overlays: IOverlayState;
    cases: ICasesState;
    menu: IMenuState;
    layers: ILayerState;
    status_bar: IStatusBarState;
    map: IMapState;
    tools: IToolsState;
    filters: IFiltersState;
    router: IRouterState
}


const reducers = {
    overlays: OverlayReducer,
    cases: CasesReducer,
    menu: MenuReducer,
    map: MapReducer,
    layers: LayersReducer,
    status_bar: StatusBarReducer,
    tools: ToolsReducer,
    filters: FiltersReducer,
	router: RouterReducer
};

const appReducer = compose(combineReducers)(reducers);

export function reducer(state: any, action: any) {
    // if(configuration.General.logActions ){
     	//const date = new Date();
    	//console.log(action.type,date.getHours(),date.getMinutes(),date.getSeconds(),date.getMilliseconds());
	// }
    return appReducer(state, action);
}

@NgModule({
    imports: [
        StoreModule.provideStore(reducer),
		StoreDevtoolsModule.instrumentOnlyWithExtension({
			maxAge: 5
		}),
		EffectsModule.run(OverlaysAppEffects),
        EffectsModule.run(MapAppEffects),
        EffectsModule.run(CasesAppEffects),
        EffectsModule.run(MenuAppEffects),
        EffectsModule.run(LayersAppEffects),
        EffectsModule.run(StatusBarAppEffects),
        EffectsModule.run(FiltersAppEffects),
		EffectsModule.run(ToolsAppEffects),
		EffectsModule.run(ContextMenuAppEffects),
		EffectsModule.run(ContextEntityAppEffects),
		EffectsModule.run(VisualizersAppEffects),
		CasesRouterModule
    ],
})

export class AppReducersModule {

}
