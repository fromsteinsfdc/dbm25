import { LightningElement, track, api } from 'lwc';
import { METRIC_NAMES, PREVIEW_PANE_SIZES, defaultReportDetails, transformConstantObject } from "c/dbmUtils";
const DUMMY_DATA_STRING = '[{"grouping":"Lorem","subgrouping":"Consectetur","value":115736,"groupingId":1650246140928,"isFirst":true,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Adipiscing","value":88018,"groupingId":1650246140928,"isFirst":false,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Eiusmod","value":122855,"groupingId":1650246140928,"isFirst":false,"id":"1650246140928"},{"grouping":"Lorem","subgrouping":"Tempor","value":62026,"groupingId":1650246140928,"isFirst":false,"id":"1650246140929"},{"grouping":"Ipsum","subgrouping":"Consectetur","value":33704,"groupingId":1650246144384,"isFirst":true,"id":"1650246144384"},{"grouping":"Ipsum","subgrouping":"Adipiscing","value":158166,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Ipsum","subgrouping":"Eiusmod","value":102873,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Ipsum","subgrouping":"Tempor","value":181465,"groupingId":1650246144384,"isFirst":false,"id":"1650246144385"},{"grouping":"Dolor","subgrouping":"Consectetur","value":16638,"groupingId":1650246149296,"isFirst":true,"id":"1650246149296"},{"grouping":"Dolor","subgrouping":"Adipiscing","value":12538,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Dolor","subgrouping":"Eiusmod","value":88559,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Dolor","subgrouping":"Tempor","value":88930,"groupingId":1650246149296,"isFirst":false,"id":"1650246149297"},{"grouping":"Sit","subgrouping":"Consectetur","value":58669,"groupingId":1650246153167,"isFirst":true,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Adipiscing","value":194768,"groupingId":1650246153167,"isFirst":false,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Eiusmod","value":24786,"groupingId":1650246153167,"isFirst":false,"id":"1650246153167"},{"grouping":"Sit","subgrouping":"Tempor","value":226838,"groupingId":1650246153167,"isFirst":false,"id":"1650246153168"},{"grouping":"Amet","subgrouping":"Consectetur","value":209758,"groupingId":1650246153539,"isFirst":true,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Adipiscing","value":7824,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Eiusmod","value":248899,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"},{"grouping":"Amet","subgrouping":"Tempor","value":169013,"groupingId":1650246153539,"isFirst":false,"id":"1650246153539"}]';

export default class DbmDatasetBuilder extends LightningElement {
    dummyDataString = DUMMY_DATA_STRING;

    @api reportDetails;
    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    @api hidePreview = false;
    @api changeLog = [];
    @api changeLogIndex = 0;

    @api
    resizePreview() {
        if (this.previewElement) {
            this.previewElement.resizeChart();
        }
    }

    // showChart;

    demoReport = true;
    previewPaneSizes = [0, 25, 50];
    previewPaneIndex = 1;
    metricNames = transformConstantObject(METRIC_NAMES);

    /* Manage the various steps of the builder */
    currentStepIndex = 0;
    builderSteps = [
        { label: 'Report Details', value: 'details' },
        { label: 'Groupings', value: 'groupings' },
        { label: 'Data', value: 'data' },
    ];
    get stepLabels() {
        return this.builderSteps.map(step => step.label);
    }
    get currentStep() {
        return this.builderSteps[this.currentStepIndex];
    }
    get currentStepIs() {
        return {
            [this.currentStep.value]: true
        }
    }

    get backButtonIsDisabled() {
        return this.currentStepIndex == 0;
    }

    get showPreviewEnlargeButton() {
        return this.previewPaneIndex < this.previewPaneSizes.length - 1;
    }

    get previewElement() {
        return this.template.querySelector('c-dbm-preview');
    }

    // get showPreviewShrinkButton() {
    //     return this.previewPaneSize != PREVIEW_PANE_SIZES.HIDDEN;
    // }

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

    connectedCallback() {
        // If report details are not already defined, start with a default template
        if (!this.reportDetails) {
            this.reportDetails = defaultReportDetails();
        }
        if (this.demoReport) {
            this.reportDetails.reportName = 'Test report';
            // this.reportDetails.grouping1name= 'Opportunity Owner';
            // this.reportDetails.grouping1dataSource = 'sobject';
            // this.reportDetails.grouping1objectName = 'Account';
        }
        this.processReportDetails();
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
        // this.changeLog[this.changeLogIndex] = JSON.parse(JSON.stringify(this.reportDetails));
        // this.changeLogIndex++;
        // this.changeLog.length = this.changeLogIndex;
    }

    handleReportDetailChange(event) {
        // console.log('in handleReportDetailChange');
        this.reportDetails = event.detail;
        this.processReportDetails();
        // this.showChart = false;
        // this.changeLog.push(JSON.parse(JSON.stringify(this.reportDetails)));
        // this.changeLogIndex = this.changeLog.length;
    }

    handleStepClick(event) {
        this.currentStepIndex = event.detail.index;
    }

    handleBackButtonClick() {
        this.currentStepIndex--;
    }

    handleNextButtonClick() {
        const currentBuilderStepComponent = this.template.querySelector('.contentPane *');
        let isValid = currentBuilderStepComponent.validate();
        if (isValid) {
            this.currentStepIndex++;
        }
    }

    handlePreviewEnlargeClick() {
        // console.log(`current previewPaneSize = ${this.previewPaneSize}`);
        if (this.previewPaneIndex < this.previewPaneSizes.length - 1) {
            this.previewPaneIndex++;
        }
    }

    handlePreviewShrinkClick() {
        // console.log(`current previewPaneSize = ${this.previewPaneSize}`);
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

    handleUndoClick() {

    }

    handleRedoClick() {

    }
}