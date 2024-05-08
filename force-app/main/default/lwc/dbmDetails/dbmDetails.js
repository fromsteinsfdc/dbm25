import { LightningElement, api, wire, track } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import { METRIC_TYPES, METRIC_NAMES, NUM_GROUPINGS_OPTIONS, DATA_SOURCE_OPTIONS, VALIDATEABLE_COMPONENTS, getReportGroupings, /*validate,*/ transformConstantObject } from 'c/dbmUtils';

const LIGHTNING_COMPONENT_PREFIX = 'lightning-';

export default class DbmDetails extends LightningElement {
    // static delegatesFocus = true;
    @api
    get reportDetails() {
        return this._reportDetails;
    }
    set reportDetails(value) {
        this._reportDetails = JSON.parse(JSON.stringify(value));
    }
    @track _reportDetails;

    metricTypes = transformConstantObject(METRIC_TYPES);
    metricNames = transformConstantObject(METRIC_NAMES);
    dataSourceOptions = transformConstantObject(DATA_SOURCE_OPTIONS).options;

    // @track grouping1DataSource;
    // @track grouping2DataSource;
    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    reportName;
    exampleDisclaimer = 'Any previews or examples in Dashboard Magic are just that. After creating your fake data, you\'ll be able to display it on a standard Lightning dashboard chart with exactly the same functionality as any other.';

    numGroupingsOptions = NUM_GROUPINGS_OPTIONS;

    numGroupings = this.numGroupingsOptions[0].value;
    get useSubgroupings() {
        return this.reportDetails.numGroupings > 1;
    }

    // @track groupings = [newGrouping(0), newGrouping(1)];

    get disableGrouping2() {
        return !this.useSubgroupings;
    }

    get groupings() {
        // console.log(`printing getReportGroupings(this.reportDetails): ${JSON.stringify(getReportGroupings(this.reportDetails))}`);
        // return getReportGroupings(this.reportDetails);
        return this.reportDetails.groupings;
    }


    /* WIRE METHODS */

    /* LIFECYCLE HOOKS */
    connectedCallback() {
    }

    renderedCallback() {
    }

    /* ACTION FUNCTIONS */
    dispatchDetails(detailName, newValue) {
        console.log('in dispatchDetails');
        const detail = { detailName, newValue };
        this.dispatchEvent(new CustomEvent('reportdetailchange', { detail }));
    }
    dispatchDetails2() {
        const detail = this.reportDetails;
        this.dispatchEvent(new CustomEvent('reportdetailchange', { detail }));
    }

    async preventDataSourceClear() {
        const result = await LightningConfirm.open({
            message: 'Changing the data source will clear all entries for this value. Proceed?',
            label: 'Confirm Clearing Data Source',
        });
        return result;
    }

    /* EVENT HANDLERS */
    handleReportDetailChange(event) {
        this.reportDetails[event.target.name] = event.detail.value;
        this.dispatchDetails2();
        /*
        const detailName = event.target.name;
        const newValue = event.detail.value;
        this.dispatchDetails(detailName, newValue);
        */
    }

    handleGroupingDetailChange(event) {
        console.log(`in handleGroupingDetailChange; ${event.target.dataset.index}, ${event.target.name}, ${event.detail.value}`);
        const groupingIndex = Number(event.target.dataset.index);
        this.reportDetails.groupings[groupingIndex][event.target.name] = event.detail.value;
        console.log(`reportDetails2: ${JSON.stringify(this.reportDetails)}`);
        this.dispatchDetails2();
        console.log(`finished handleGroupingDetailChange`);

        /*
        const detailName = event.target.dataset.grouping + event.target.name;
        const newValue = event.detail.value;
        this.dispatchDetails(detailName, newValue);
        */
    }

    handleGroupingObjectFieldChange(event) {
        const groupingIndex = Number(event.target.dataset.index);
        this.reportDetails[groupings[groupingIndex]].objectName = newObjectValue;
        this.reportDetails[groupings[groupingIndex]].fieldName = newFieldValue;
        this.dispatchDetails2(reportDetails);

        /*
        const objectDetailName = event.target.dataset.grouping + 'objectName';
        const newObjectValue = event.detail.objectValue;
        const fieldDetailName = event.target.dataset.grouping + 'fieldName';
        const newFieldValue = event.detail.fieldValue;
        this.dispatchDetails(objectDetailName, newObjectValue);
        this.dispatchDetails(fieldDetailName, newFieldValue);
        */
    }

    /* UTILITY FUNCTIONS */
    @api validate() {
        console.log('in dbmDetails validate');
        let allValid = true;
        for (let tagName of VALIDATEABLE_COMPONENTS) {
            console.log(`tagName = ${tagName}`);
            for (let el of this.template.querySelectorAll(tagName)) {
                console.log(el);
                allValid = el.reportValidity() && allValid;
            }
        }
        return allValid;
    }
}