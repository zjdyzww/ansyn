import {
	ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnInit,
	ViewChild
} from '@angular/core';
import { schemeCategory10, selectAll, selection } from 'd3';
import * as d3 from 'd3/build/d3';
import eventDrops from './src/index';

import { TimelineEmitterService } from '../../services/timeline-emitter.service';
import { isEqual } from 'lodash';
import { OverlayDrop, OverlayLine } from '@ansyn/overlays';
import { TimelineState } from '@ansyn/overlays/reducers/overlays.reducer';
import { select } from 'd3-selection';
import _ = require('lodash');
import enLocale from 'd3-time-format/locale/en-US.json';

export const BASE_DROP_COLOR = '#d393e1';
selection.prototype.moveToFront = function () {
	return this.each(function () {
		this.parentNode.appendChild(this);
	});
};


export interface ClickEvent {
	id: string,
	clickTime: number
}


@Component({
	selector: 'ansyn-timeline',
	templateUrl: './timeline.component.html',
	styleUrls: ['./timeline.component.less'],
	changeDetection: ChangeDetectionStrategy.OnPush
})


export class TimelineComponent implements OnInit {
	@ViewChild('context') context: ElementRef;


	private _drops: Array<OverlayLine> = [];
	private _markup;

	@Input() timelineState: any;
	@Input() redraw$: EventEmitter<any>;
	private firstClick: ClickEvent;
	private seondClick: ClickEvent;
	private chart: any;


	private _dropNotOnDOM: Array<any>;

	set dropNotOnDom(value) {
		this._dropNotOnDOM = value;
	}

	get dropNotOnDom() {
		return this._dropNotOnDOM;
	}

	@Input()
	set markup(value) {
		if (!isEqual(this._markup, value)) {
			this._markup = value;
			this.drawMarkup();
		}
	}

	@HostListener('window:resize')
	onresize() {
		this.redraw$.emit();
	}


	@Input()
	set drops(drops: Array<OverlayLine>) {
		if (drops && drops.length) {
			this._drops = drops.map(entities => ({
				name: entities.name || '',
				data: entities.data
			}));
			this.initEventDropsSequence();
		}
	}

	get drops() {
		return this._drops;
	}

	get actualDrops() {
		return this.drops[0].data;
	}

	get markup() {
		return this._markup;
	}


	constructor(protected emitter: TimelineEmitterService) {
	}

	ngOnInit() {
		this.redraw$.subscribe(value => {
			this.initEventDropsSequence();
		});
	}

	initEventDropsSequence() {
		if (this.drops && this.drops.length) {
			this.initEventDrop();
			this.drawMarkup();
			this.fixMetaballs();
		}
	}

	fixMetaballs() {
		selectAll('.drop-line')
			.append('rect')
			.attr('x', 0)
			.attr('y', 20)
			.attr('height', 40)
			.attr('width', 1)
			.attr('fill', 'transparent');
	}

	onMouseOver(d) {
		this.emitter.provide('timeline:mouseover').next(d);
	}

	onMouseOut(d) {
		this.emitter.provide('timeline:mouseout').next(d);
	}

	onZoomEnd() {
		const dates: TimelineState = {
			from: this.chart.scale().domain()[0],
			to: this.chart.scale().domain()[1]
		};
		this.emitter.provide('timeline:zoomend')
			.next(dates);
	}

	onClick(d) {
		d3.event.stopPropagation();
		const timeTolarance = 300;
		if (this.firstClick && this.firstClick.id === d.id && (Date.now() - this.firstClick.clickTime < timeTolarance)) {
			this.seondClick = {
				id: d.id,
				clickTime: Date.now()
			};
			this.emitter.provide('timeline:dblclick').next(d);
		}
		else {
			this.firstClick = {
				id: d.id,
				clickTime: Date.now()
			};
			this.seondClick = null;
			window.setTimeout((() => {
				if (
					this.seondClick &&
					this.seondClick.id === d.id &&
					this.firstClick &&
					this.firstClick.id === d.id &&
					(this.firstClick.clickTime - this.seondClick.clickTime < timeTolarance)
				) {
					return;
				}
				else {
					this.firstClick = null;
					this.emitter.provide('timeline:click').next(d);
				}
			}).bind(this), timeTolarance);
		}
	}


	initEventDrop(): void {
		const configuration = {
			locale: {
				"dateTime": "%x, %X",
				"date": "%-m/%-d/%Y",
				"time": "%-I:%M:%S %p",
				"periods": ["AM", "PM"],
				"days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
				"shortDays": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
				"months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
				"shortMonths": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
			},
			range: {
				start: new Date(new Date().getTime() - 3600000 * 24 * 365),
				end: new Date()
			},
			margin: {
				top: 60,
				left: 50,
				bottom: 40,
				right: 50
			},
			line: {
				color: (d, i) => schemeCategory10[i]
			},
			drop: {
				onMouseOver: this.onMouseOver.bind(this),
				onMouseOut: this.onMouseOut.bind(this),
				onClick: (this.onClick.bind(this)),
				color: BASE_DROP_COLOR,
				date: d => new Date(d.date)
			},
			zoom: {
				onZoom: this.drawMarkup.bind(this),
				onZoomEnd: this.onZoomEnd.bind(this)
			},
			d3: d3
		};

		configuration.range = this.timelineState ? {start: this.timelineState.from, end: this.timelineState.to} : configuration.range;
		this.chart = eventDrops(configuration);
		d3.select('#timeLineEventDrop')
			.data([this.drops])
			.call(this.chart);

		if (this._markup) {
			this.drawMarkup();
		}
	}


	drawMarkup() {
		const dropsElements = selectAll('.drop');
		dropsElements
			.attr('class', (drop: OverlayDrop) => {
				let classList = 'drop';
				const markUpElement = this.markup.find(markupItem => markupItem.id === drop.id);
				if (markUpElement) {
					markUpElement.found = true;
				}
				return (markUpElement) ? classList.concat(' changedDrops').concat(' ' + markUpElement.class) : classList;
			});
		if (this.drops && this.drops.length) {
			this.dropNotOnDom = this.markup.filter(dropElement => !dropElement.found).map(dropElement => {
				const drop = this.actualDrops.find(drop => drop.id === dropElement.id);
				return drop ? { ...drop, class: dropElement.class } : {};
			});
		}
		this.forceDraw();
		this.arrangeDrops(dropsElements);
	}

	arrangeDrops(drops) {
		(<any>drops.filter('.changedDrops')).moveToFront();
		(<any>drops.filter('.active')).moveToFront();
		drops.filter('.favorites').style('filter', 'url(#highlight)');
	}

	forceDraw() {
		if (this.dropNotOnDom) {
			this.dropNotOnDom.forEach(drop => {
				if (drop) {
					select('.drops')
						.append('circle')
						.attr('class', 'drop changedDrops'.concat(' ' + drop.class).concat(' fake'))
						.attr('r', 5)
						.attr('fill', BASE_DROP_COLOR)
						.on('click', () => this.onClick(drop))
						.on('mouseover', () => this.onMouseOver(drop))
						.on('mouseout', () => this.onMouseOut(drop))
						.attr('cx', () => {
							if (drop.date) {
								return this.chart.scale()(drop.date)
							}
							else {
								console.log("no date?"  + drop.id);
								return null
							}
						});
				}
			});
		}

	}
}
