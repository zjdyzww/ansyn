import { inject, TestBed } from '@angular/core/testing';
import { TasksService } from './tasks.service';
import { OverlaysService } from '../../../overlays/services/overlays.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { StorageService } from '../../../core/services/storage/storage.service';

describe('TasksService', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				TasksService,
				{ provide: 'algorithmsConfig', useValue: {} },
				{ provide: StorageService, useValue: {} },
				{ provide: OverlaysService, useValue: {} },
				{ provide: ErrorHandlerService, useValue: {} }
			]
		});
	});

	it('should be created', inject([TasksService], (service: TasksService) => {
		expect(service).toBeTruthy();
	}));
});
