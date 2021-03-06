import { inject, TestBed } from '@angular/core/testing';
import { MultipleOverlaysSourceProvider } from './multiple-source-provider';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { cold } from 'jasmine-marbles';
import * as turf from '@turf/turf';
import { RouterTestingModule } from '@angular/router/testing';
import { MultipleOverlaysSource, OverlaySourceProvider } from '../models/overlays-source-providers';
import { BaseOverlaySourceProvider, IFetchParams } from '../models/base-overlay-source-provider.model';
import { MultipleOverlaysSourceConfig } from '../../core/models/multiple-overlays-source-config';
import { LoggerService } from '../../core/services/logger.service';
import { GeoRegisteration, IOverlay, IOverlaysFetchData } from '../models/overlay.model';

const overlays: IOverlaysFetchData = {
	data: [
		{
			id: '1',
			name: 'overlay',
			isGeoRegistered: GeoRegisteration.geoRegistered,
			photoTime: new Date().toISOString(),
			date: new Date(),
			azimuth: 0
		}],
	limited: 1,
	errors: []
};

const emptyOverlays: IOverlaysFetchData = {
	data: [],
	limited: 0,
	errors: []
};

const faultySourceType = 'Faulty';

@OverlaySourceProvider({
	sourceType: 'Truthy'
})
class TruthyOverlaySourceProviderMock extends BaseOverlaySourceProvider {
	public fetch(fetchParams: IFetchParams): Observable<IOverlaysFetchData> {
		if (fetchParams.limit <= 0) {
			return of(emptyOverlays);
		}

		return of(overlays);
	}

	public getById(id: string, sourceType: string = null): Observable<IOverlay> {
		return EMPTY;
	}
}

@OverlaySourceProvider({
	sourceType: faultySourceType
})
class FaultyOverlaySourceProviderMock extends BaseOverlaySourceProvider {
	public fetch(fetchParams: IFetchParams): Observable<IOverlaysFetchData> {
		return throwError(new Error('Failed to fetch overlays'));
	}

	public getById(id: string, sourceType: string = null): Observable<IOverlay> {
		return EMPTY;
	}
}

const faultyError = new Error(`Failed to fetch overlays from ${ faultySourceType }`);
const regionCoordinates = [
	[
		[
			-180,
			-90
		],
		[
			-180,
			90
		],
		[
			180,
			90
		],
		[
			180,
			-90
		],
		[
			-180,
			-90
		]
	]
];

const fetchParams: any = {
	limit: 250,
	region: turf.geometry('Polygon', regionCoordinates),
	timeRange: { start: new Date().toISOString(), end: new Date().toISOString() },
	dataInputFilters: []
};

const fetchParamsWithLimitZero: any = { ...fetchParams, limit: 0 };

const whitelist = [
	{
		name: 'Entire Earth',
		dates: [
			{
				start: null,
				end: null
			}
		],
		sensorNames: [null],
		coverage: [regionCoordinates]
	}
];
const loggerServiceMock = { error: (some) => null };

describe('MultipleSourceProvider', () => {

	describe('MultipleSourceProvider with one truthy provider', () => {

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [
					{
						provide: LoggerService,
						useValue: loggerServiceMock
					},
					MultipleOverlaysSourceProvider,
					{
						provide: MultipleOverlaysSourceConfig,
						useValue: {
							indexProviders: {
								Truthy: { whitelist: whitelist, blacklist: [] }
							}
						}
					},
					{
						provide: MultipleOverlaysSource,
						useClass: TruthyOverlaySourceProviderMock,
						multi: true
					}
				]
			});
		});

		beforeEach(inject([MultipleOverlaysSourceProvider], _multipleSourceProvider => {
			this.multipleSourceProvider = _multipleSourceProvider;
		}));

		it('should return the correct overlays', () => {
			const expectedResults = cold('(b|)', { b: overlays });

			expect(this.multipleSourceProvider.fetch(fetchParams)).toBeObservable(expectedResults);
		});

		it('should return an empty array if there are no overlays', () => {
			const expectedResults = cold('(b|)', { b: emptyOverlays });

			expect(this.multipleSourceProvider.fetch(fetchParamsWithLimitZero)).toBeObservable(expectedResults);
		});

	});

	describe('MultipleSourceProvider with one faulty provider', () => {

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [
					{
						provide: LoggerService,
						useValue: loggerServiceMock
					},
					MultipleOverlaysSourceProvider,
					{
						provide: MultipleOverlaysSourceConfig,
						useValue: {
							indexProviders: {
								Faulty: { whitelist: whitelist, blacklist: [] }
							}
						}
					},
					{
						provide: MultipleOverlaysSource,
						useClass: FaultyOverlaySourceProviderMock,
						multi: true
					}
				]
			});
		});

		beforeEach(inject([MultipleOverlaysSourceProvider], _multipleSourceProvider => {
			this.multipleSourceProvider = _multipleSourceProvider;
		}));

		it('should return an error', () => {
			const expectedResults = cold('(b|)', { b: { errors: [faultyError], data: null, limited: -1 } });

			expect(this.multipleSourceProvider.fetch(fetchParams)).toBeObservable(expectedResults);
		});

	});

	describe('MultipleSourceProvider with one faulty provider and one truthy provider', () => {

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [RouterTestingModule],
				providers: [
					{
						provide: LoggerService,
						useValue: loggerServiceMock
					},
					MultipleOverlaysSourceProvider,
					{
						provide: MultipleOverlaysSourceConfig,
						useValue: {
							indexProviders: {
								Truthy: { whitelist: whitelist, blacklist: [] },
								Faulty: { whitelist: whitelist, blacklist: [] }
							}
						}
					},
					{
						provide: MultipleOverlaysSource,
						useClass: TruthyOverlaySourceProviderMock,
						multi: true
					},
					{
						provide: MultipleOverlaysSource,
						useClass: FaultyOverlaySourceProviderMock,
						multi: true
					}
				]
			});
		});

		beforeEach(inject([MultipleOverlaysSourceProvider], _multipleSourceProvider => {
			this.multipleSourceProvider = _multipleSourceProvider;
		}));

		it('should return the expected overlays with one error', () => {
			const expectedResults = cold('(b|)', { b: { ...overlays, errors: [faultyError] } });

			expect(this.multipleSourceProvider.fetch(fetchParams)).toBeObservable(expectedResults);
		});

		it('should return an empty overlays array with one error', () => {
			const expectedResults = cold('(b|)', { b: { ...emptyOverlays, errors: [faultyError] } });

			expect(this.multipleSourceProvider.fetch(fetchParamsWithLimitZero)).toBeObservable(expectedResults);
		});

	});

});
