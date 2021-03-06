import { Component } from '@angular/core';
import { helpComponentConstants } from '../components/help.component.const';
import { HelpLocalStorageService } from '../services/help.local-storage.service';

@Component({
	selector: 'ansyn-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.less']
})
export class HelpComponent {

	get const() {
		return helpComponentConstants;
	}

	constructor(public helpLocalStorageService: HelpLocalStorageService) {
	}

	img(imgName) {
		return this.const.IMG_PATH + imgName;
	}
}
