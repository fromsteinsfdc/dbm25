// TODO: don't include blank cells when not checked (and validate to ensure at least 1 is populated)
// TODO: disable bulk add button for non-text options
// TODO: build list view
// TODO: make content pane components auto-focus on first element
// TODO: set up timeout for error if PE never returns
// TODO: add redo/undo functionality
// TODO: add re-ordering
// TODO: percent needs to be divided by 100
// TODO (on hold): Add users to the report details object so images can be shown on screen
// TODO (on hold): add option to display text options as links


import { LightningElement, track, api, wire } from 'lwc';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled, } from 'lightning/empApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningAlert from 'lightning/alert';
import { EVENTS, METRIC_NAMES, PREVIEW_PANE_SIZES, defaultReportDetails, transformConstantObject } from "c/dbmUtils";
import getPackageNamespace from '@salesforce/apex/DBM25Controller.getPackageNamespace';
import saveReportDetails from '@salesforce/apex/DBM25Controller.saveReportDetails';
import createReport from '@salesforce/apex/DBM25Controller.createReport';
import getReportFolders from '@salesforce/apex/DBM25Controller.getReportFolders';

const DUMMY_DATA_STRING = '[{"grouping":"Lorem","subgrouping":"Consectetur","value":115736,"groupingId":1650246140928,"isFirst":true,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Adipiscing","value":88018,"groupingId":1650246140928,"isFirst":false,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Eiusmod","value":122855,"groupingId":1650246140928,"isFirst":false,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Tempor","value":62026,"groupingId":1650246140928,"isFirst":false,"id":"1650246140929"},{"grouping":"Ipsum","subgrouping":"Consectetur","value":33704,"groupingId":1650246144384,"isFirst":true,"id":"1650246144384"},{"grouping":"Ipsum","subgrouping":"Adipiscing","value":158166,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Ipsum","subgrouping":"Eiusmod","value":102873,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Ipsum","subgrouping":"Tempor","value":181465,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Dolor","subgrouping":"Consectetur","value":16638,"groupingId":1650246149296,"isFirst":true,"id":"1650246149296"},{"grouping":"Dolor","subgrouping":"Adipiscing","value":12538,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Dolor","subgrouping":"Eiusmod","value":88559,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Dolor","subgrouping":"Tempor","value":88930,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Sit","subgrouping":"Consectetur","value":58669,"groupingId":1650246153167,"isFirst":true,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Adipiscing","value":194768,"groupingId":1650246153167,"isFirst":false,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Eiusmod","value":24786,"groupingId":1650246153167,"isFirst":false,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Tempor","value":226838,"groupingId":1650246153167,"isFirst":false,"id":"1650246153168"},{"grouping":"Amet","subgrouping":"Consectetur","value":209758,"groupingId":1650246153539,"isFirst":true,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Adipiscing","value":7824,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Eiusmod","value":248899,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Tempor","value":169013,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"}]';

// import DBMREPORT_OBJECT from "@salesforce/schema/DBM_Report__c";
// import DBMREPORTGROUPING_OBJECT from "@salesforce/schema/DBM_Report_Grouping__c";
// import DBMREPORTGROUPINGENTRY_OBJECT from "@salesforce/schema/DBM_Report_Grouping_Entry__c";
// import DBMDATAENTRY_OBJECT from "@salesforce/schema/DBM_Data_Entry__c";
// import REPORT_NAME_FIELD from "@salesforce/schema/DBM_Report__c.Name";

const PLATFORM_EVENT = {
    CHANNEL_NAME: '/event/DBM_Event__e',
    SUCCESS_FIELD: `Is_Success__c`,
    MESSAGE_FIELD: `Message__c`,
    REPORT_ID_FIELD: 'Report_ID__c',
}

const ERROR_WAIT = 15000;

export default class DbmDatasetBuilder extends LightningElement {

    // @wire(getPackageNamespace)
    // namespace;
    @api namespace;
    @api
    get reportDetails() {
        return this._reportDetails;
    }
    set reportDetails(value) {
        this._reportDetails = JSON.parse(JSON.stringify(value));
    }
    _reportDetails;

    dummyDataString = DUMMY_DATA_STRING;    // DELETE ME

    // @api reportDetails;
    @api changeLog = [];
    @api changeLogIndex = 0;

    @track reportFolders = [];
    subscription;   // Used for receiving Platform Event

    previewPaneSizes = [0, 25, 50];
    previewPaneIndex = 1;
    metricNames = transformConstantObject(METRIC_NAMES);
    // showSubmitModal = false;
    @track showSpinner = false;

    showConfirm = false;
    saveSubmmitted = false;
    saveSuccessful;

    /* Manage the various steps of the builder */
    currentStepIndex = 0;
    builderSteps = [
        { label: 'Report Details', value: 'details' },
        { label: 'Groupings', value: 'groupings' },
        { label: 'Data', value: 'data' },
        { label: 'Finalize', value: 'finalize' },
    ];

    /* GETTERS */
    get stepLabels() {
        return this.builderSteps.map(step => step.label);
    }
    get currentStep() {
        return this.builderSteps[this.currentStepIndex] || {};
    }
    get currentStepIs() {
        return {
            [this.currentStep.value]: true
        }
    }
    get isFinalStep() {
        return this.currentStepIndex === this.builderSteps.length - 1;
    }

    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    get reportLink() {
        if (this.reportDetails?.reportId) {
            return '/' + this.reportDetails.reportId;
        }
        return null;
    }

    get nextButton() {
        return {
            label: this.showConfirm ? 'Confirm' : (this.isFinalStep ? 'Submit' : 'Next'),
            variant: this.showConfirm ? 'success' : (this.isFinalStep ? 'brand' : 'neutral'),
            isDisabled: this.saveSubmmitted
        }
    }

    get backButtonIsDisabled() {
        return this.currentStepIndex == 0 || this.showSpinner || this.showConfirm;
    }

    get showPreviewEnlargeButton() {
        return this.previewPaneIndex < this.previewPaneSizes.length - 1;
    }

    get previewElement() {
        return this.template.querySelector('c-dbm-preview');
    }

    get previewPaneWidth() {
        return this.previewPaneSizes[this.previewPaneIndex];
    }

    get previewPaneStyle() {
        let styles = [`width: ${this.previewPaneWidth}% !important`];
        if (this.previewPaneWidth) {
            styles.push('margin-left: 1em');
            styles.push('padding-left: 1em');
            styles.push('border-left: 1px solid rgb(116,116,116, .5)');
        }
        return styles.join('; ');
    }

    /* LIFECYCLE HOOKS */
    connectedCallback() {
        console.log(`in dbmDatasetBuilder, reportDetails = ${JSON.stringify(this.reportDetails)}`);
        // If report details are not already defined, start with a default template
        if (!this.reportDetails) {
            this.reportDetails = defaultReportDetails();
        }
        this.processReportDetails();
        this.getReportFolders();

        // Subscribe to Platform Event
        const self = this;
        const messageCallback = function (response) {
            self.handlePlatformEventReceipt(response);
        }
        if (!this.subscription) {
            subscribe(PLATFORM_EVENT.CHANNEL_NAME, -1, messageCallback).then(response => {
                this.subscription = response;
            });
        }

    }

    rendered;
    renderedCallback() {
        this.resizePreview();
        if (!this.rendered) {
            this.rendered = true;
            this.template.querySelector('.previewPane').addEventListener("transitionend", () => {
                this.resizePreview();
            });

        }
    }

    /* ACTION FUNCTIONS */
    resetBuilder() {
        this.reportDetails = defaultReportDetails();
        this.processReportDetails();
        this.currentStepIndex = 0;
        this.getReportFolders();
    }

    async saveReport() {
        console.log(`in saveReport, about to call Apex`);
        console.log(`reportDetails = ${JSON.stringify(this.reportDetails)}`);
        // this.showSubmitModal = false;
        this.saveSubmmitted = true;
        this.showSpinner = true;
        try {
            let reportDetailsRecordId = await saveReportDetails({ reportDetailsString: JSON.stringify(this.reportDetails) });
            console.log(`Report successfully saved. Result: ${JSON.stringify(reportDetailsRecordId)}`);
            this.reportDetails.reportDetailsRecordId = reportDetailsRecordId;
            this.dispatchReportDetails();
            await createReport({ reportDetailsRecordId: reportDetailsRecordId });
            setTimeout(() => {
                if (!this.saveSuccessful) {
                    this.processSaveResult(`This is awkward. It doesn't seem like your report has been generated, though the DBM Report record has been created, with the ID of ${reportDetailsRecordId}. So maybe go check that out? Sorry about this!`);
                }
            }, ERROR_WAIT);
        } catch (error) {
            console.log(`Error saving report: ${JSON.stringify(error)}`);
            let errorMessage = 'There was an unknown error saving your report.';
            if (error.body?.pageErrors?.length) {
                errorMessage = `Error: ${error.body.pageErrors[0].message}. Code = ${error.body.pageErrors[0].statusCode}`;

            } else if (error.body.message) {
                errorMessage = `Error: ${error.body.message}.`;
                if (error.body.exceptionType) {
                    errorMessage += ` Code = ${error.body.exceptionType}.`;
                }
                if (error.body.stackTrace) {
                    errorMessage += ' ' + error.body.stackTrace;
                }
            }
            this.processSaveResult(errorMessage);
        }
    }

    processReportDetails() {
        this.reportDetails.metricLabel = this.reportDetails.metricName === METRIC_NAMES.CUSTOM.value ? this.reportDetails.customMetricName : this.metricNames.findFromValue(this.reportDetails.metricName).label;
        this.reportDetails.groupings.forEach((grouping, index) => {
            // Update classString for columns in dbmGroupings            
            let classList = ['slds-col'];
            if (index < this.reportDetails.numGroupings) {
                classList.push(`slds-size_1-of-${this.reportDetails.numGroupings}`);
            } else {
                classList.push('slds-hide');
            }
            grouping.classString = classList.join(' ');

            // Update dataSourceIs for conditional visibility based on dataSource
            grouping.dataSourceIs = {
                [grouping.dataSource]: true
            };

            // Update isDisabled
            grouping.isDisabled = index >= Number(this.reportDetails.numGroupings)
        });
        // console.log(`processReportDetails finished: ${JSON.stringify(this.reportDetails)}`);
        // this.changeLog[this.changeLogIndex] = JSON.parse(JSON.stringify(this.reportDetails));
        // this.changeLogIndex++;
        // this.changeLog.length = this.changeLogIndex;
    }

    async getReportFolders() {
        try {
            this.reportFolders = await getReportFolders();
        } catch (error) {
            console.log(`Error getting report folders: ${JSON.stringify(error)}`);
        }
    }

    processSaveResult(errorMessage) {
        if (errorMessage) {
            this.saveSuccessful = false;
            const toast = new ShowToastEvent({
                title: 'Something Went Wrong',
                message: errorMessage,
                variant: 'error',
                mode: 'sticky'
            });
            this.dispatchEvent(toast);
        } else {
            this.saveSuccessful = true;
            this.currentStepIndex++;
            const toast = new ShowToastEvent({
                title: 'Success',
                message: `Your report has been successfully generated`,
                variant: 'success',
            });
            this.dispatchEvent(toast);
        }
        this.showSpinner = false;
    }

    dispatchReportDetails() {
        this.processReportDetails();
        this.dispatchEvent(new CustomEvent(EVENTS.REPORT_DETAIL_CHANGE, { detail: this.reportDetails }))
    }

    /* EVENT HANDLERS */
    handleReportDetailChange(event) {
        this.reportDetails = event.detail;
        this.dispatchReportDetails();
    }

    handleBackToListViewClick() {
        const detail = {
            target: EVENTS.TARGETS.LIST_VIEW
        }
        this.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, { detail }));
    }

    handleStepClick(event) {
        this.currentStepIndex = event.detail.index;
    }

    handleBackButtonClick() {
        this.currentStepIndex--;
    }

    handleNextButtonClick(event) {
        const currentBuilderStepComponent = this.template.querySelector('.contentPane *');
        let isValid = currentBuilderStepComponent.validate();
        if (isValid) {
            if (this.showConfirm) {
                this.saveReport();
            } else if (this.isFinalStep) {
                // event.target.disabled = true;
                this.showConfirm = true;
            } else {
                this.currentStepIndex++;
            }
        }
    }

    handlePreviewEnlargeClick() {
        if (this.previewPaneIndex < this.previewPaneSizes.length - 1) {
            this.previewPaneIndex++;
        }
    }

    handlePreviewShrinkClick() {
        if (this.previewPaneIndex > 0) {
            this.previewPaneIndex--;
        }
    }

    // If the user has clicked their mouse in the `data` component and not on a cell or header, clear the selection
    handleContentPaneMouseUp() {
        // console.log(`in dbmDatasetBuilder handleContentPaneMouseUp`);
        let dataCmp = this.template.querySelector('c-dbm-dataset-data');
        if (dataCmp && !dataCmp.preventClearSelection()) {
            dataCmp.clearSelectedElements();
        }
    }

    // handleSaveButtonClick() {
    //     console.log(`in handleSaveButtonClick`);
    //     this.saveReport();
    // }

    async handleGenerateReportClick() {
        console.log(`in handleGenerateReportClick`);
        let result = await createReport();
        console.log(`result = ${JSON.stringify(result)}`);
    }

    handleCopyToClipboardClick() {
        console.log(`in handleCopyToClipboardClick, about to dispatch ${EVENTS.COPY_TO_CLIPBOARD}`);
        const detail = {
            string: JSON.stringify(this.reportDetails)
        };
        // console.log(`detail = ${JSON.stringify(detail)}`);
        this.dispatchEvent(new CustomEvent(EVENTS.COPY_TO_CLIPBOARD, { detail }))
        // this.dispatchEvent(EVENTS.COPY_TO_CLIPBOARD);
        // this.dispatchEvent(EVENTS.COPY_TO_CLIPBOARD, { detail });
        // console.log(`finished handleCopyToClipboardClick`);
    }

    handlePlatformEventReceipt(response) {
        console.log(`platform event received: ${JSON.stringify(response)}`);
        const payload = response.data.payload;
        const errorMessage = payload[this.prependNamespace(PLATFORM_EVENT.MESSAGE_FIELD)];
        const reportId = payload[this.prependNamespace(PLATFORM_EVENT.REPORT_ID_FIELD)];
        const isSuccess = payload[this.prependNamespace(PLATFORM_EVENT.SUCCESS_FIELD)];
        console.log(`PLATFORM_EVENT.MESSAGE_FIELD in payload = ${this.prependNamespace(PLATFORM_EVENT.MESSAGE_FIELD) in payload}`);
        console.log(`errorMessage = ${errorMessage}`);
        if (isSuccess) {
            this.reportDetails.reportId = reportId;
            this.processSaveResult();
        } else {
            this.processSaveResult(errorMessage);
        }

        /*
        let success = false;
        
        if (PLATFORM_EVENT.SUCCESS_FIELD in payload) {
            console.log(`${PLATFORM_EVENT.SUCCESS_FIELD} is in payload, so setting success to ${payload[PLATFORM_EVENT.SUCCESS_FIELD]}`);
            success = payload[PLATFORM_EVENT.SUCCESS_FIELD];
        } else if (`${NAMESPACE}__${PLATFORM_EVENT.SUCCESS_FIELD}` in payload) {
            success = payload[`${NAMESPACE}__${PLATFORM_EVENT.SUCCESS_FIELD}`];
        } else {
            console.log(`not found in payload, so success stays false`);
        }

        if (PLATFORM_EVENT.SUCCESS_FIELD in payload || `${NAMESPACE}__${PLATFORM_EVENT.SUCCESS_FIELD}` in payload) {
            // this.processSaveResult(payload[PLATFORM_EVENT.SUCCESS_FIELD])
            this.processSaveResult(success)
        }
        */
    }

    handleUndoClick() {

    }

    handleRedoClick() {

    }

    /*
    handleSubmitModalCancelClick() {
        this.showSubmitModal = false;
    }

    handleSubmitModalSaveClick() {
        this.saveReport();
    }
    */

    /* UTILITY FUNCTIONS */
    @api
    resizePreview() {
        if (this.previewElement) {
            this.previewElement.resizeChart();
        }
    }

    prependNamespace(str) {
        // if (this.namespace?.data) {
        //     return `${this.namespace.data}__${str}`;
        // }
        if (this.namespace) {
            return `${this.namespace}__${str}`;
        }
        return str;
    }
}