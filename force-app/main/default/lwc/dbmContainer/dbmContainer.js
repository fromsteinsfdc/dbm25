import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { EVENTS, NAVIGATION, METRIC_NAMES, METRIC_TYPES, defaultReportDetails, transformConstantObject } from "c/dbmUtils";
import getReportDetailRecords from '@salesforce/apex/DBM25Controller.getReportDetailRecords';
import getPackageNamespace from '@salesforce/apex/DBM25Controller.getPackageNamespace';

import DBMREPORT_OBJECT from "@salesforce/schema/DBM_Report__c";
import REPORT_NAME_FIELD from "@salesforce/schema/DBM_Report__c.Name";
import REPORT_METRICLABEL_FIELD from "@salesforce/schema/DBM_Report__c.Metric_Label__c";
import REPORT_METRICTYPE_FIELD from "@salesforce/schema/DBM_Report__c.Metric_Type__c";
import REPORT_FOLDERNAME_FIELD from "@salesforce/schema/DBM_Report__c.Report_Folder_name__c";
import REPORT_REPORTID_FIELD from "@salesforce/schema/DBM_Report__c.Report_ID__c";
import REPORT_NUMBEOFGROUPINGS_FIELD from "@salesforce/schema/DBM_Report__c.Number_of_Groupings__c";

import DBMREPORTGROUPING_OBJECT from "@salesforce/schema/DBM_Report_Grouping__c";
import GROUPING_NAME_FIELD from "@salesforce/schema/DBM_Report_Grouping__c.Name";
import GROUPING_DATASOURCE_FIELD from "@salesforce/schema/DBM_Report_Grouping__c.Data_Source__c";
import GROUPING_OBJECTNAME_FIELD from "@salesforce/schema/DBM_Report_Grouping__c.Object_Name__c";
import GROUPING_FIELDNAME_FIELD from "@salesforce/schema/DBM_Report_Grouping__c.Field_Name__c";
import GROUPING_DISPLAYASLINK_FIELD from "@salesforce/schema/DBM_Report_Grouping__c.Display_as_Link__c";

import DBMREPORTGROUPINGENTRY_OBJECT from "@salesforce/schema/DBM_Report_Grouping_Entry__c";
import GROUPINGENTRY_NAME_FIELD from "@salesforce/schema/DBM_Report_Grouping_Entry__c.Name";
import GROUPINGENTRY_GROUPING_FIELD from "@salesforce/schema/DBM_Report_Grouping_Entry__c.Grouping__c";
import GROUPINGENTRY_GROUPINGORDER_FIELD from "@salesforce/schema/DBM_Report_Grouping_Entry__c.Grouping_Order__c";
import GROUPINGENTRY_RECORDID_FIELD from "@salesforce/schema/DBM_Report_Grouping_Entry__c.Record_ID__c";
import GROUPINGENTRY_USER_FIELD from "@salesforce/schema/DBM_Report_Grouping_Entry__c.User__c";

import DBMDATAENTRY_OBJECT from "@salesforce/schema/DBM_Data_Entry__c";
import DATAENTRY_NAME_FIELD from "@salesforce/schema/DBM_Data_Entry__c.Name";
import DATAENTRY_VALUE_FIELD from "@salesforce/schema/DBM_Data_Entry__c.Value__c";
import DATAENTRY_GROUPING1_FIELD from "@salesforce/schema/DBM_Data_Entry__c.Grouping_1__c";
import DATAENTRY_GROUPING2_FIELD from "@salesforce/schema/DBM_Data_Entry__c.Grouping_2__c";

// Id, Name, Metric_Label__c, Metric_Type__c, Number_of_Groupings__c, Report_Folder_name__c, Report_ID__c, LastModifiedDate, 
// (SELECT Name, Id, Data_Source__c, Object_Name__c, Field_Name__c, Display_as_Link__c FROM DBM_Report_Groupings__r), 
// (SELECT Name, Id, Grouping__c, Grouping_Order__c, Record_ID__c FROM DBM_Report_Grouping_Entries__r),
// (SELECT Id, Name, Value__c, Grouping_1__c, Grouping_2__c FROM DBM_Data_Entries__r) 
// FROM DBM_Report__c ORDER BY LastModifiedDate DESC];


const MENU_PANEL_OPTIONS = [
    { name: 'existing', label: 'View Existing Datasets', iconName: 'utility:record_alt' },
    { name: 'new', label: 'Build Dataset', iconName: 'utility:record_create' },
    { name: 'settings', label: 'Settings', iconName: 'utility:settings' },
    { name: 'help', label: 'Help', iconName: 'utility:help_center' },
]

export default class DbmContainer extends LightningElement {
    @wire(getPackageNamespace)
    namespace;

    @track reportDetailRecords = [];
    reportDetailRecordsLoaded = false;

    menuPanelIsOpen = true;
    menuPanelOptions = [];
    selectedMenuPanelOption;
    showDatasetBuilder = false;

    get menuPanelClass() {
        let classes = ['menuPanel', 'slds-panel', 'slds-size_medium', 'slds-panel_docked', 'slds-panel_docked-left'];
        if (this.menuPanelIsOpen) {
            classes.push('slds-is-open');
        }
        return classes.join(' ');
    }

    activePanel;
    get activePanelIs() {
        return {
            [this.activePanel]: true
        }
    }

    get showSpinner() {
        return !this.reportDetailRecordsLoaded;
    }

    /* LIFECYCLE HOOKS */
    connectedCallback() {
        console.log(`DBMDATAENTRY_OBJECT = ${JSON.stringify(DBMDATAENTRY_OBJECT)}`);
        console.log(`REPORT_NAME_FIELD = ${JSON.stringify(REPORT_NAME_FIELD)}`);

        this.activePanel = Object.values(NAVIGATION.TARGETS)[0];

        if (!this.reportDetailRecordsLoaded) {
            this.fetchReportDetailRecords();
        }
    }

    /* ACTION FUNCTIONS */
    async fetchReportDetailRecords() {
        this.reportDetailRecordsLoaded = false;
        try {
            this.reportDetailRecords = await getReportDetailRecords();
        } catch (error) {
            console.log(`Error getting report detail records: ${JSON.stringify(error)}`);
        }
        this.reportDetailRecordsLoaded = true;
    }

    /* EVENT HANDLERS */
    handleReportDetailChange(event) {
        console.log(`in dbmContainer, reportDetails: ${JSON.stringify(event.detail)}`);
    }

    handleNewDatasetClick() {
        this.reportDetails = null;
        this.activePanel = NAVIGATION.TARGETS.DATASET_BUILDER;
    }

    handleRefreshRecordsList() {
        console.log(`in handleRefreshRecordsList`);
        this.fetchReportDetailRecords();
    }

    handleNavigation(event) {
        console.log(`in dbmContainer handleNavigation, event = ${JSON.stringify(event.detail)}`);
        this.reportDetails = this.processApexRecord(event.detail.reportDetailRecord);
        this.activePanel = event.detail.target;
    }

    /* UTILITY FUNCTIONS */
    processApexRecord(sobjectData) {
        console.log(`in processApexRecord`);
        let reportDetails = defaultReportDetails();
        if (sobjectData) {
            // Populate Report Details properties
            reportDetails.reportDetailsRecordId = sobjectData.Id;
            reportDetails.reportName = sobjectData[REPORT_NAME_FIELD.fieldApiName];
            let metricLabel = sobjectData[REPORT_METRICLABEL_FIELD.fieldApiName];
            let standardLabel = Object.values(METRIC_NAMES).find(metricName => metricName.label === metricLabel);
            console.log(`standardLabel = ${standardLabel}`);
            if (standardLabel) {
                reportDetails.metricName = standardLabel.value;
            } else {
                reportDetails.metricName = METRIC_NAMES.CUSTOM.value;
                reportDetails.metricIsCustom = true;
                reportDetails.customMetricName = metricLabel;
            }
            // reportDetails.metricLabel = ;
            reportDetails.metricType = Object.values(METRIC_TYPES).find(type => type.label === sobjectData[REPORT_METRICTYPE_FIELD.fieldApiName]).value;
            reportDetails.folderDeveloperName = sobjectData[REPORT_FOLDERNAME_FIELD.fieldApiName];
            reportDetails.reportId = sobjectData[REPORT_REPORTID_FIELD.fieldApiName];
            reportDetails.numGroupings = sobjectData[REPORT_NUMBEOFGROUPINGS_FIELD.fieldApiName];


            // (SELECT Name, Id, Grouping_Number__c, Data_Source__c, Object_Name__c, Field_Name__c, Display_as_Link__c FROM DBM_Report_Groupings__r ORDER BY Grouping_Number__c ASC), 
            // (SELECT Name, Id, Grouping__c, Grouping_Order__c, Record_ID__c, User__c FROM DBM_Report_Grouping_Entries__r ORDER BY Grouping_Order__c ASC),
            console.log(`Report Object details finished: ${JSON.stringify(reportDetails)}`);

            let data = [];

            // Populate Grouping and Grouping Entry properties
            sobjectData[this.prependNamespace('DBM_Report_Groupings__r')].forEach((groupingSobject, groupingIndex) => {
                console.log(`in grouping ${groupingIndex}: ${JSON.stringify(groupingSobject)}`);
                let grouping = reportDetails.groupings[groupingIndex];
                grouping.id = groupingSobject.Id;
                grouping.name = groupingSobject[GROUPING_NAME_FIELD.fieldApiName];
                grouping.dataSource = groupingSobject[GROUPING_DATASOURCE_FIELD.fieldApiName];
                grouping.objectName = groupingSobject[GROUPING_OBJECTNAME_FIELD.fieldApiName];
                grouping.fieldName = groupingSobject[GROUPING_FIELDNAME_FIELD.fieldApiName];
                // grouping.displayAsLink = groupingSobject[GROUPING_DISPLAYASLINK_FIELD.fieldApiName];
                let groupingEntrySobjects = sobjectData[this.prependNamespace('DBM_Report_Grouping_Entries__r')].filter(gentrySobject => gentrySobject[GROUPINGENTRY_GROUPING_FIELD.fieldApiName] === grouping.id);
                grouping.entries = groupingEntrySobjects.map((gentrySobject, gentryIndex) => {
                    if (groupingIndex === 0) {
                        data.push([null]);
                    } else if (groupingIndex === 1 && gentryIndex > 0) {
                        data.forEach(row => {
                            row.push(null);
                        })
                    }
                    return {
                        id: gentrySobject.Id,
                        value: gentrySobject[GROUPINGENTRY_NAME_FIELD.fieldApiName],
                        recordId: gentrySobject[GROUPINGENTRY_RECORDID_FIELD.fieldApiName],
                    }
                });
            });
            console.log(`groupings after groupings populated: ${JSON.stringify(reportDetails.groupings)}`);
            console.log(`data after grouping entries populated: ${JSON.stringify(data)}`);

            // Populate Data Entry properties
            let dataEntrySobjects = sobjectData[this.prependNamespace('DBM_Data_Entries__r')];
            dataEntrySobjects.forEach(dataEntrySobject => {
                const grouping1 = dataEntrySobject[DATAENTRY_GROUPING1_FIELD.fieldApiName];
                const grouping2 = dataEntrySobject[DATAENTRY_GROUPING2_FIELD.fieldApiName];
                console.log(`dataEntry = ${JSON.stringify(dataEntrySobject)}`);
                console.log(`grouping1 = ${grouping1}, grouping2 = ${grouping2}`);
                let rowIndex = reportDetails.groupings[0].entries.findIndex(groupingEntry => groupingEntry.id === grouping1);
                let colIndex = grouping2 ? reportDetails.groupings[1].entries.findIndex(groupingEntry => groupingEntry.id === grouping2) : 0;
                console.log(`rowIndex = ${rowIndex}, colIndex = ${colIndex}, value = ${dataEntrySobject[DATAENTRY_VALUE_FIELD.fieldApiName]}`);

                data[rowIndex][colIndex] = dataEntrySobject[DATAENTRY_VALUE_FIELD.fieldApiName];
            });
            reportDetails.data = data;
        }
        console.log(`reportDetails = ${JSON.stringify(reportDetails)}`);
        return reportDetails;
    }

    prependNamespace(str) {
        if (this.namespace?.data) {
            return `${this.namespace.data}__${str}`;
        }
        return str;
    }


    /* Unused code related to menu panels (no longer in use) */
    selectMenuPanelOption(optionName) {
        console.log(`in selectMenuPanelOption, selecting "${optionName}"`);
        this.selectedMenuPanelOption = optionName;
        this.menuPanelOptions.forEach((option) => {
            option.isSelected = option.name === optionName;
        })
        this.menuPanelOptions = this.menuPanelOptions.map(option => option);
    }

    handleMenuPanelToggleClick() {
        this.menuPanelIsOpen = !this.menuPanelIsOpen;
        let appContainer = this.template.querySelector('.appContainer');
        appContainer.classList.toggle('panelCollapsed');
    }

    handleMenuPanelOptionClick(event) {
        console.log(`in handleMenuPanelOptionClick`);
        console.log(`${JSON.stringify(event.currentTarget.dataset)}`);
        this.selectMenuPanelOption(event.currentTarget.dataset.name);
    }

    handleCopyToClipboard(event) {
        console.log(`in handleCopyToClipboard`);// ${event}`);
        let copyString;
        if (event.detail.string) {
            copyString = event.detail.string;
        } else if (event.detail.sobjectRecord) {
            copyString = JSON.stringify(this.processApexRecord(event.detail.sobjectRecord));
        }
        navigator.clipboard.writeText(copyString).then(
            () => {
                /* clipboard successfully set */
                const toast = new ShowToastEvent({
                    title: 'Success',
                    message: 'A JSON (code) string containing your report details has been successfully copied to your clipboard',
                    variant: 'success',
                });
                this.dispatchEvent(toast);

            },
            async () => {
                /* clipboard write failed */
                await LightningAlert.open({
                    message: 'this is the alert message',
                    theme: 'error', // a red theme intended for error states
                    label: 'Error!', // this is the header text
                });
                //Alert has been closed
            },
        );

    }

    newMenuPanelOption(optionObject, isSelected) {
        const itemClassList = ['slds-nav-vertical__item', 'slds-nav-vertical__title', 'slds-p-left_x-small'];
        let newOption = {
            isSelected,
            name: optionObject.name,
            label: optionObject.label,
            iconName: optionObject.iconName,
            get navItemClass() {
                let classList = [...itemClassList];
                if (this.isSelected) {
                    classList.push('slds-is-active');
                }
                return classList.join(' ');
            }
        }
        return newOption;
    }
    /**/

}