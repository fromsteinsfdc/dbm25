import { LightningElement, api, wire, track } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import { METRIC_TYPES, METRIC_NAMES, NUM_GROUPINGS_OPTIONS, DATA_SOURCE_OPTIONS, VALIDATEABLE_COMPONENTS, getReportGroupings, /*validate,*/ transformConstantObject } from 'c/dbmUtils';
import getPicklistValues from '@salesforce/apex/DBM25Controller.getPicklistValues';

const LIGHTNING_COMPONENT_PREFIX = 'lightning-';

export default class DbmDatasetDetails extends LightningElement {
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
    dataSources = transformConstantObject(DATA_SOURCE_OPTIONS);

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
    dispatchDetails() {
        const detail = this.reportDetails;
        this.dispatchEvent(new CustomEvent('reportdetailchange', { detail }));
    }

    async confirmGroupingPropertyClear(event, functionName) {
        console.log(`in confirmGroupingPropertyClear`);
        const targetElement = event.target;
        const groupingIndex = Number(targetElement.dataset.index);
        let grouping = this.reportDetails.groupings[groupingIndex];
        if (grouping.entries.some(entry => {
            return entry.value;
        })) {
            console.log(`at least one grouping entry has a value, so we need to ask for confirmation`);
            const result = await LightningConfirm.open({
                // message: 'Changing the data source will clear all entries for this value. Proceed?',
                message: targetElement.dataset.confirmClearMessage,
                label: 'Confirm Clearing Entries'
                // variant: 'headerless',
            });
            if (result) {
                console.log(`confirmed, let's delete`);
                targetElement[functionName]();
                grouping.entries = [];
                grouping.presetEntries = [];    // Not sure if this is necessary, better safe than sorry
            }
        } else {
            console.log(`no grouping entry has a value, so no confirmation is required`)
            targetElement[functionName]();
            grouping.entries = [];
            grouping.presetEntries = [];
        }
    }

    /* EVENT HANDLERS */
    handleReportDetailChange(event) {
        this.reportDetails[event.target.name] = event.detail.value;
        if (event.target.name === 'metricName') {
            this.reportDetails.metricIsCustom = event.detail.value === METRIC_NAMES.CUSTOM.value;
        }
        this.dispatchDetails();
    }

    handleGroupingNumberChange(event) {
        
    }

    handleGroupingDetailChange(event) {
        const groupingIndex = Number(event.target.dataset.index);
        let grouping = this.reportDetails.groupings[groupingIndex];
        grouping[event.target.name] = event.detail.value;
        if (event.target.name === 'dataSource') {
            let selectedDataSource = this.dataSources.options.find(source => source.value === grouping.dataSource);
            if (selectedDataSource?.presetEntries) {
                grouping.presetEntries = selectedDataSource.presetEntries;
            }
        }
        this.dispatchDetails();
    }

    handleGroupingObjectFieldChange(event) {
        const groupingIndex = Number(event.target.dataset.index);
        let grouping = this.reportDetails.groupings[groupingIndex];
        grouping.objectName = event.detail.objectValue;
        grouping.fieldName = event.detail.fieldValue;
        this.dispatchDetails();

        if (grouping.dataSource === DATA_SOURCE_OPTIONS.PICKLIST.value) {
            getPicklistValues({ objectName: event.detail.objectValue, fieldName: event.detail.fieldValue }).
                then(result => {
                    this.reportDetails.groupings[groupingIndex].presetEntries = result; // Need to use full reportDetails reference because just referencing `grouping` wasn't working. Maybe because of the async promise?
                    this.dispatchDetails();
                }).catch(error => {
                    console.log(`getPicklistValues error: ${JSON.stringify(error)}`);
                });
        }
    }

    handleGroupingPropertyClearRequest(event) {
        console.log(`in handleGroupingPropertyClearRequest`);
        this.confirmGroupingPropertyClear(event, 'clearSelection');
    }

    handleGroupingPropertyObjectClearRequest(event) {
        console.log(`in handleGroupingPropertyObjectClearRequest`);
        this.confirmGroupingPropertyClear(event, 'clearObjectSelection');
    }

    handleGroupingPropertyFieldClearRequest(event) {
        console.log(`in handleGroupingPropertyFieldClearRequest`);
        this.confirmGroupingPropertyClear(event, 'clearFieldSelection');
    }

    /* UTILITY FUNCTIONS */
    @api validate() {
        let allValid = true;
        for (let tagName of VALIDATEABLE_COMPONENTS) {
            for (let el of this.template.querySelectorAll(tagName)) {
                allValid = el.reportValidity() && allValid;
            }
        }
        return allValid;
    }
}