import { LightningElement, api } from 'lwc';

export default class DbmagicPreviewChart extends LightningElement {
    @api chartDetails;
    @api chartLabels;
    @api chartDatasets;
    @api chartTitle;
    @api linearAxis;
    @api linearLabel;
    @api categoryAxis;
    @api categoryLabel;
    @api displayLegend;
    @api legendLabel;
    @api stacked;
    @api ticksCallback;
    @api dontAnimate;
    
    connectedCallback() {
        this.displayLegend = Boolean(this.displayLegend);
        this.stacked = Boolean(this.stacked);
    }
}