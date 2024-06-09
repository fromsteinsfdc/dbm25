// TODO: make content pane components auto-focus on first element
// TODO: fix preview pane sizing
// TODO: add email notifications
// TODO: add Settings
// TODO: add Help
// TODO: add re-ordering
// TODO: percent needs to be divided by 100
// TODO: finish post-save behaviour
// TODO (on hold): Add users to the report details object so images can be shown on screen
// TODO (on hold): add option to display text options as links
// TODO (complete): build list view
// TODO (complete): set up timeout for error if PE never returns
// TODO (complete): disable bulk add button for non-text options
// TODO (complete): don't include blank cells when not checked (and validate to ensure at least 1 is populated)
// TODO (complete): add redo/undo functionality


import { LightningElement, track, api, wire } from 'lwc';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled, } from 'lightning/empApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import LightningAlert from 'lightning/alert';
import LightningPrompt from 'lightning/prompt';
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
const DEBOUNCE_WAIT = 50;

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
    timer;

    @track reportFolders = [];
    subscription;   // Used for receiving Platform Event

    previewPaneSizes = [0, 25, 50];
    previewPaneIndex = 1;
    metricNames = transformConstantObject(METRIC_NAMES);
    // showSubmitModal = false;
    showImportModal = false;
    showSpinner = false;
    defaultReportDetails = { ...this.processReportDetails(defaultReportDetails()) };
    initialReportDetails;

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
    // get isFinalStep() {
    //     return this.currentStepIndex === this.builderSteps.length;
    // }

    get currentBuilderStepComponent() {
        return this.template.querySelector('.contentPane *');
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
            label: 'Next',
            isDisabled: this.currentStepIndex === this.builderSteps.length - 1,
            // label: this.showConfirm ? 'Confirm' : (this.isFinalStep ? 'Submit' : 'Next'),
            // variant: this.showConfirm ? 'success' : (this.isFinalStep ? 'brand' : 'neutral'),
            // isDisabled: this.saveSubmmitted
        }
    }

    get backButtonDisabled() {
        return this.currentStepIndex === 0 || this.showSpinner || this.showConfirm;
    }

    get undoButtonDisabled() {
        return this.changeLogIndex === 0;
    }

    get redoButtonDisabled() {
        return this.changeLogIndex === this.changeLog.length - 1;
    }

    get isChanged() {
        return JSON.stringify(this.reportDetails) !== JSON.stringify(this.initialReportDetails);
    }

    get saveButtonDisabled() {
        return !this.isChanged;
    }

    get saveAsButtonDisabled() {
        return this.saveButtonDisabled || !this.reportDetails.reportId;
    }

    get changeLogString() {
        let string = JSON.stringify(this.changeLog[this.changeLogIndex - 1]);
        return string;
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

    get contentPaneStyle() {
        let styles = [`max-width: ${100 - this.previewPaneWidth}% !important`];
        styles.push(`width: ${100 - this.previewPaneWidth}% !important`);
        return styles.join('; ');
    }
    get contentPaneStyleString() {
        return JSON.stringify(this.contentPaneStyle);
    }

    get previewPaneStyle() {
        let styles = [`min-width: ${this.previewPaneWidth}% !important`];
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
            this.reportDetails = { ...this.defaultReportDetails };
        } else {
            this.reportDetails = this.processReportDetails(this.reportDetails);
        }
        this.resetChangeLog();
        this.getReportFolders();

        // Subscribe to Platform Event
        this.subscribeToPlatformEvent();
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
        this.reportDetails = { ...this.defaultReportDetails };
        // this.reportDetails = defaultReportDetails();
        // this.processReportDetails();
        this.currentStepIndex = 0;
        this.resetChangeLog();
        this.getReportFolders();
    }

    resetChangeLog() {
        this.initialReportDetails = { ...this.reportDetails };
        this.changeLogIndex = 0;
        this.changeLog = [{ ...this.reportDetails }];
    }

    async saveReportDetails() {
        console.log(`in saveReport, about to call Apex`);
        console.log(`reportDetails = ${JSON.stringify(this.reportDetails)}`);
        // this.showSubmitModal = false;
        this.saveSubmmitted = true;
        this.showSpinner = true;
        // Process blank values into zeroes, if specified
        if (this.reportDetails.saveBlanksAsZeroes) {
            this.data.forEach(row => row.forEach(cell => {
                if (cell === null) {
                    cell = 0;
                }
            }));
        }
        try {
            let saveResponse = await saveReportDetails({ reportDetailsString: JSON.stringify(this.reportDetails) });
            let reportDetailsRecordId = saveResponse.reportId;
            // let reportDetailsRecordId = await saveReportDetails({ reportDetailsString: JSON.stringify(this.reportDetails) });
            console.log(`Report successfully saved. Result: ${JSON.stringify(reportDetailsRecordId)}`);
            this.reportDetails.id = reportDetailsRecordId;
            this.dispatchReportDetails();
            this.generateReportMetadata();
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

    async generateReportMetadata() {
        await createReport({ reportDetailsRecordId: this.reportDetails.id });
        setTimeout(() => {
            if (!this.saveSuccessful) {
                this.processSaveResult(`This is awkward. It doesn't seem like your report has been generated, though the DBM Report record has been created, with the ID of ${reportDetailsRecordId}. So maybe go check that out? Sorry about this!`);
            }
        }, ERROR_WAIT);
    }

    processReportDetails(reportDetails) {
        reportDetails.metricLabel = reportDetails.metricName === METRIC_NAMES.CUSTOM.value ? reportDetails.customMetricName : this.metricNames.findFromValue(reportDetails.metricName).label;
        reportDetails.groupings.forEach((grouping, index) => {
            // Update classString for columns in dbmGroupings            
            let classList = ['slds-col', 'slds-p-horizontal_xxx-small'];
            if (index < reportDetails.numGroupings) {
                classList.push(`slds-size_1-of-${reportDetails.numGroupings}`);
            } else {
                classList.push('slds-hide');
            }
            grouping.classString = classList.join(' ');

            // Update dataSourceIs for conditional visibility based on dataSource
            grouping.dataSourceIs = {
                [grouping.dataSource]: true
            };

            grouping.groupingNumber = (Number(index) + 1);
            grouping.inputLabel = 'Enter Name for Grouping #' + (Number(index) + 1);

            // Update isDisabled
            grouping.isDisabled = index >= Number(reportDetails.numGroupings)
        });
        return reportDetails;
    }

    updateReportDetails(reportDetails, updateChangeLog = true) {
        let newProcessedReportDetails = this.processReportDetails(reportDetails);
        if (JSON.stringify(this.reportDetails) !== JSON.stringify(newProcessedReportDetails)) {
            this.reportDetails = newProcessedReportDetails;
            this.dispatchReportDetails();
            if (updateChangeLog) {
                this.changeLogIndex++;
                this.changeLog[this.changeLogIndex] = { ...this.reportDetails };
                this.changeLog.length = this.changeLogIndex + 1;
            }
        }
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
            this.dispatchEvent(new CustomEvent(EVENTS.REFRESH_RECORDS));
            this.saveSuccessful = true;
            this.currentStepIndex++;
            this.resetChangeLog();
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
        // this.processReportDetails();
        this.dispatchEvent(new CustomEvent(EVENTS.REPORT_DETAIL_CHANGE, { detail: this.processReportDetails(this.reportDetails) }))
    }

    importReportDetails() {
        const importModalInput = this.template.querySelector('.importTextarea');
        if (importModalInput) {
            let importedDetails = JSON.parse(importModalInput.value);
            importedDetails.id = null;
            importedDetails.reportId = null;
            this.updateReportDetails(importedDetails);
            // this.reportDetails = this.processReportDetails(JSON.parse(importModal.value));
            // this.processReportDetails();
        }
        this.closeImportModal();
    }

    closeImportModal() {
        this.showImportModal = false;
    }

    /* EVENT HANDLERS */
    handleReportDetailChange(event) {
        this.updateReportDetails(event.detail);
    }

    async handleBackToListViewClick() {
        // The user made any changes, confirm before leaving. Check to see if (1) an unsaved report is back to its default state, or (2) a cloned report is not back to 
        // if (!(this.reportDetails.id && JSON.stringify(this.reportDetails) === JSON.stringify(this.defaultReportDetails)) && 
        //     /*!this.undoButtonDisabled || */(!this.reportDetails.id && JSON.stringify(this.reportDetails) !== JSON.stringify(this.defaultReportDetails))) {
        if (this.isChanged) {
            const result = await LightningConfirm.open({
                message: 'If you leave this page you will lose your unsaved changes. Are you sure you want to go back to the list view?',
                label: 'Confirm Back',
                theme: 'info'
            });
            if (!result) {
                return;
            }
        }
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
        let isValid = this.currentBuilderStepComponent.validate();
        if (isValid) {
            // if (this.showConfirm) {
            //     this.saveReportDetails();
            // } else if (this.isFinalStep) {
            //     // event.target.disabled = true;
            //     this.showConfirm = true;
            // } else {
            this.currentStepIndex++;
            // }
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
            dataCmp.unselectSelectedElements();
        }
    }

    async handleSaveButtonClick() {
        console.log(`in handleSaveButtonClick`);
        if (await this.validateSave()) {
            this.saveReportDetails();
        }
    }

    async handleSaveAsButtonClick() {
        if (await this.validateSave()) {
            let newName = await LightningPrompt.open({
                message: 'Enter name for cloned report',
                label: 'Enter New Report Name', // this is the header text
                defaultValue: `Copy of ${this.reportDetails.reportName}`
            });
            if (newName) {
                console.log(`going to clone ${newName}`);
                this.reportDetails.reportName = newName;
                this.reportDetails.id = null;
                this.reportDetails.reportId = null;
                this.saveReportDetails();
            } else {
                console.log(`no clone for you!`);
            }
        }
    }

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

    handleImportClick() {
        this.showImportModal = true;
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
        this.changeLogIndex--;
        // console.log(JSON.stringify(this.changeLog[this.changeLogIndex]));
        // this.reportDetails = this.changeLog[this.changeLogIndex];
        // this.dispatchReportDetails();
        this.updateReportDetails(this.changeLog[this.changeLogIndex], false);
    }

    handleRedoClick() {
        this.changeLogIndex++;
        this.updateReportDetails(this.changeLog[this.changeLogIndex], false);
        // this.reportDetails = this.changeLog[this.changeLogIndex];
        // this.dispatchReportDetails();
    }

    /*
    handleSubmitModalCancelClick() {
        this.showSubmitModal = false;
    }

    handleSubmitModalSaveClick() {
        this.saveReportDetails();
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
        if (this.namespace) {
            return `${this.namespace}__${str}`;
        }
        return str;
    }

    subscribeToPlatformEvent() {
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

    async validateSave() {
        let isValid = this.currentBuilderStepComponent.validate();
        if (isValid) {
            // Additional validation
            let invalidMessage;
            let validGroupingEntries = this.reportDetails.groupings.every(grouping => {
                return grouping.isDisabled || grouping.entries.some(entry => entry.value);
            });
            let validData = isValid = this.reportDetails.data.some(row => row.some(cell => cell !== null));
            let validFolderName = !!this.reportDetails.folderDeveloperName;
            if (!validGroupingEntries) {
                invalidMessage = 'Each grouping level must have at least one valid entry';
            } else if (!validData) {
                invalidMessage = 'At least one data entry must have a numeric value';
            } else if (!validFolderName) {
                invalidMessage = 'Please select a folder to save your report in'
            }
            if (invalidMessage) {
                await LightningAlert.open({
                    message: invalidMessage,
                    theme: 'error', // a red theme intended for error states
                    label: 'Missing Required Information', // this is the header text
                });
            } else {
                return true;
            }
        }
        return false;
    }
}