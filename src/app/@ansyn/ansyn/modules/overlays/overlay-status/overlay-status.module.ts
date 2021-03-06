import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MapFacadeModule } from '@ansyn/map-facade';
import { BackToBaseMapComponent } from './components/back-to-base-map/back-to-base-map.component';
import { OverlayStatusEffects } from './effects/overlay-status.effects';
import { OverlayStatusComponent } from './overlay-status.component';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { overlayStatusFeatureKey, OverlayStatusReducer } from './reducers/overlay-status.reducer';
import { TranslateModule } from '@ngx-translate/core';
import { ImageProcessingControlComponent } from "./components/image-processing-control/image-processing-control.component";
import { FormsModule } from "@angular/forms";

@NgModule({
	declarations: [OverlayStatusComponent, BackToBaseMapComponent, ImageProcessingControlComponent],
	entryComponents: [OverlayStatusComponent, BackToBaseMapComponent, ImageProcessingControlComponent],
	imports: [
		CommonModule,
		StoreModule.forFeature(overlayStatusFeatureKey, OverlayStatusReducer),
		EffectsModule.forFeature([OverlayStatusEffects]),
		MapFacadeModule.provide({
			entryComponents: {
				status: [OverlayStatusComponent, BackToBaseMapComponent],
				container: [],
				floating_menu: []
			}
		}),
		TranslateModule,
		FormsModule,
	],
	exports: [ImageProcessingControlComponent]
})
export class OverlayStatusModule {
}
