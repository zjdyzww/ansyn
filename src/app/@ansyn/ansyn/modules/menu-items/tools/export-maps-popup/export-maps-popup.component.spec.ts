import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportMapsPopupComponent } from './export-maps-popup.component';
import { ImageryCommunicatorService } from '@ansyn/imagery';
import { MatDialog, MatDialogRef } from '@angular/material';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StoreModule } from '@ngrx/store';
import { mapFeatureKey, MapReducer } from '@ansyn/map-facade';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientModule } from '@angular/common/http';
import { credentialsConfig } from '../../../core/services/credentials/config';
import { LoggerService } from '../../../core/services/logger.service';
import { LoggerConfig } from '../../../core/models/logger.config';
import { toolsConfig } from '../models/tools-config';


describe('ExportMapsPopupComponent', () => {
	let component: ExportMapsPopupComponent;
	let fixture: ComponentFixture<ExportMapsPopupComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ExportMapsPopupComponent],
			imports: [MatProgressBarModule,
				HttpClientModule,
				StoreModule.forRoot({ [mapFeatureKey]: MapReducer }),
				TranslateModule.forRoot()],
			providers: [ImageryCommunicatorService,
				{ provide: MatDialogRef, useValue: {} },
				{ provide: MatDialog, useValue: {} },
				{
					provide: credentialsConfig,
					useValue: {
						noCredentialsMessage: 'TEST'
					}
				},
				{
					provide: toolsConfig,
					useValue: {
						exportMap: {
							target: '',
							excludeClasses: []
						}
					}
				},
				LoggerService,
				{
					provide: LoggerConfig,
					useValue: {}
				}
			]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ExportMapsPopupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
