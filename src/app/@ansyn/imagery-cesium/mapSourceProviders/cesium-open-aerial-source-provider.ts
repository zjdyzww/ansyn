import {
	IBaseImageryLayer,
	BaseMapSourceProvider,
	IBaseImageryMapConstructor,
	ImageryMapSource,
	IMapSettings
} from '@ansyn/imagery';
import { CesiumMap } from '../maps/cesium-map/cesium-map';
import { CesiumLayer } from '../models/cesium-layer';

declare const Cesium: any;

@ImageryMapSource({
	sourceType: 'OPEN_AERIAL',
	supported: [CesiumMap]
})
export class CesiumOpenAerialSourceProvider extends BaseMapSourceProvider {
	readonly supported: IBaseImageryMapConstructor[];

	protected create(metaData: IMapSettings): Promise<IBaseImageryLayer> {
		const openAerialLayer = new Cesium.UrlTemplateImageryProvider({
			url: metaData.data.overlay.imageUrl
		});
		const layer = new CesiumLayer(openAerialLayer);
		return Promise.resolve(layer);
	}
}
