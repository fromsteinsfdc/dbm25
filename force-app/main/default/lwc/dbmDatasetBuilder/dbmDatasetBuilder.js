import { LightningElement, track, api } from 'lwc';
import { PREVIEW_PANE_SIZES, defaultReportDetails } from "c/dbmUtils";

export default class DbmDatasetBuilder extends LightningElement {
    @api reportDetails;
    @api hidePreview = false;

    demoReport = true;

    previewPaneSize = PREVIEW_PANE_SIZES.LARGE;

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


    get contentPaneClass() {
        let classList = ['contentPane', 'slds-div', 'slds-col'];
        if (this.hidePreview) {
            classList.push('slds-size_1-of-1');
        } else if (this.previewPaneSize === PREVIEW_PANE_SIZES.LARGE) {
            classList.push('slds-size_1-of-2');
        } else if (this.previewPaneSize === PREVIEW_PANE_SIZES.SMALL) {
            classList.push('slds-size_3-of-4');
        }
        return classList.join(' ');
    }

    get previewPaneClass() {
        let classList = ['previewPane', 'slds-div', 'slds-col', 'slds-border_left'];
        if (this.hidePreview) {
            classList.push('slds-hide');
        } else if (this.previewPaneSize === PREVIEW_PANE_SIZES.LARGE) {
            classList.push('slds-size_1-of-2');
        } else if (this.previewPaneSize === PREVIEW_PANE_SIZES.SMALL) {
            classList.push('slds-size_1-of-4');
        }
        return classList.join(' ');
    }

    connectedCallback() {
        // If report details are not already defined, start with a default template
        if (!this.reportDetails) {
            this.reportDetails = defaultReportDetails();
            this.processReportDetails();
        }
        if (this.demoReport) {
            this.reportDetails.reportName = 'Test report';
            // this.reportDetails.grouping1name= 'Opportunity Owner';
            // this.reportDetails.grouping1dataSource = 'sobject';
            // this.reportDetails.grouping1objectName = 'Account';
        }
    }

    processReportDetails() {
        this.reportDetails.groupings.forEach((grouping, index) => {
            grouping.dataSourceIs = {
                [grouping.dataSource]: true
            };
            grouping.isDisabled = index >= Number(this.reportDetails.numGroupings)
        })
    }

    handleReportDetailChange(event) {
        console.log('in handleReportDetailChange');
        console.log(JSON.stringify(event.detail));
        this.reportDetails = event.detail;
        this.processReportDetails();
        // Determines if we're changing a single value or the entire reportDetails object
        /*
        if (event.detail.detailName) {
            this.reportDetails = {
                ...this.reportDetails,
                [event.detail.detailName]: event.detail.newValue,

            }
        } else {
            this.reportDetails = event.detail;
        }
        */
        console.log('new reportDetails:');
        console.log(JSON.stringify(this.reportDetails));
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
}