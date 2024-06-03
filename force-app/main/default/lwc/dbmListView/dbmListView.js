import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';

import { EVENTS } from "c/dbmUtils";
import getReportDetailRecords from '@salesforce/apex/DBM25Controller.getReportDetailRecords';
import deleteReports from '@salesforce/apex/DBM25Controller.deleteReports';

import REPORT_REPORTID_FIELD from "@salesforce/schema/DBM_Report__c.Report_ID__c";

const COLUMNS = [
    { label: 'Report Name', fieldName: 'Name', type: 'text', sortable: true, hideDefaultActions: true },
    { label: 'Metric Name', fieldName: 'Metric_Label__c', type: 'text', sortable: true },
    { label: 'Metric Type', fieldName: 'Metric_Type__c', type: 'text', sortable: true },
    { label: 'Number of Groupings', fieldName: 'Number_of_Groupings__c', type: 'number', sortable: true },
    { label: 'Last Modified Date', fieldName: 'LastModifiedDate', type: 'date', sortable: true },
    /*
    {
        label: '', type: 'button-icon', hideLabel: true, fixedWidth: 40,
        typeAttributes: {
            name: 'openDataset',
            iconName: 'utility:play',
            alternativeText: 'Open Dataset Builder ',
            title: 'Open Dataset Builder',
        }
    },
    {
        label: '', type: 'button-icon', fixedWidth: 40,
        typeAttributes: {
            name: 'clone',
            iconName: 'utility:copy',
            alternativeText: 'Clone report',
            title: 'Clone report',
        }
    },
    {
        label: '', type: 'button-icon', fixedWidth: 40,
        typeAttributes: {
            name: 'copy',
            iconName: 'utility:copy_to_clipboard',
            alternativeText: 'Copy dataset source code',
            title: 'Copy dataset source code',
        }
    },
    {
        label: '', type: 'button-icon', fixedWidth: 40,
        typeAttributes: {
            name: 'openReport',
            iconName: 'utility:new_window',
            alternativeText: 'Open report',
            title: 'Open report',
        }
    },    
    {
        label: '', type: 'button-icon', hideLabel: true, fixedWidth: 40,
        typeAttributes: {
            name: 'preview',
            iconName: 'utility:preview',
            alternativeText: 'Preview chart',
            title: 'Preview chart',
        }
    },
    */
];

const ACTION_TYPES = {
    MULTI: 'multiRowAction',
    SINGLE: 'singleRowAction',
}

const DEFAULT_SORT_DIRECTION = 'asc';

export default class DbmListView extends LightningElement {
    /*
    @wire(getReportDetailRecords)
    wiredReportDetailRecords({ error, data }) {
        if (error) {
            console.log(`Error loading report detail records: ${JSON.stringify(error)}`);
        }
        if (data) {
            console.log(`reportDetailRecords = ${JSON.stringify(data)}`);
            this.showSpinner = false;
            this.reportDetailRecords = data;
            // this.tableRows = this.processRecordsIntoRows(data);
        }
    }
    */

    @api reportDetailRecords = [];

    @api
    get namespace() {
        return this._namespace;
    }
    set namespace(value) {
        this._namespace = value;
        if (this.namespace) {
            this.columns.forEach(col => {
                // Only add namespace to custom fields, and where namespace hasn't already been added
                if (col.fieldName?.includes('__c') && !col.fieldName?.startsWith(`${this.namespace}__`)) {
                    col.fieldName = this.prependNamespace(col.fieldName);
                }
            })
        }
    }
    _namespace;

    // @track tableRows = [];
    @track reportDetailRecords = [];
    @track selectedRowIndexes = [];

    showSpinner;
    columns = COLUMNS;
    sortDirection = DEFAULT_SORT_DIRECTION;
    sortedBy;
    numberOfSelectedRows = 0;
    searchTerm;

    get tableRows() {
        return this.processRecordsIntoRows(this.reportDetailRecords);
    }

    get allRowsSelected() {
        return this.selectedRowIndexes.length === this.tableRows.length;
    }

    // get disableSingleRowActions() {
    //     return this.numberOfSelectedRows !== 1;
    // }

    // get disableMultiRowActions() {
    //     return this.numberOfSelectedRows === 0;
    // }

    @track rowActions = [
        { name: 'open', iconName: 'utility:open', isSingleRowAction: true, tooltip: 'Open in Dataset Builder', title: 'Open' },
        { name: 'clone', iconName: 'utility:copy', isSingleRowAction: true, tooltip: 'Clone dataset', title: 'Clone' },
        { name: 'copy', iconName: 'utility:copy_to_clipboard', isSingleRowAction: true, tooltip: 'Copy dataset code to clipboard', title: 'Copy', onclick: () => this.copyToClipboard() },
        { name: 'openReport', iconName: 'utility:new_window', isSingleRowAction: true, tooltip: 'Open report in Report Builder', title: 'Open Report' },
        { name: 'preview', iconName: 'utility:preview', isSingleRowAction: true, tooltip: 'Preview dataset in side panel', title: 'Preview' },
        { name: 'delete', iconName: 'utility:delete', isSingleRowAction: false, tooltip: 'Delete selected dataset(s)', title: 'Delete', onclick: () => this.deleteReports() },
    ];
    

    /* LIFECYCLE HOOKS */
    connectedCallback() {
        // if (!this.reportDetailRecords)
        // this.showSpinner = true;
        // console.log(`reportDetailRecords = ${JSON.stringify(this.reportDetailRecords.data)}`);
    }

    /* ACTION FUNCTIONS */
    processRecordsIntoRows(records) {
        // console.log(`in processRecordsIntoRows`);
        // console.log(`in processRecordsIntoRows, records = ${JSON.stringify(records)}`);
        let selectedRowCount = 0;
        let rows = records.map((record, rowIndex) => {
            let row = {
                id: record.Id,
                reportId: record[REPORT_REPORTID_FIELD.fieldApiName],
                fields: []
            };
            this.columns.forEach((col, colIndex) => {
                row.fields.push({
                    isFirst: colIndex === 0,
                    fieldName: col.fieldName,
                    fieldType: col.type,
                    fieldLabel: col.label,
                    value: record[col.fieldName],
                    [`is${col.fieldName}`]: true,
                    [`is${col.type}`]: true
                });
                if (row.fields[colIndex].fieldName === this.prependNamespace('Number_of_Groupings__c')) {
                    // console.log(`in number of groupings`);
                    let groupings = record[this.prependNamespace('DBM_Report_Groupings__r')];
                    if (groupings) {
                        let groupingNames = groupings.map(grouping => grouping.Name);
                        // console.log(`groupingNames = ${JSON.stringify(groupingNames)}`);
                        row.fields[colIndex].value += ` (${groupings.map(grouping => grouping.Name).join(', ')})`;
    
                    }
                }
                // Filter `isHidden` property based on `searchTerm`
                if (this.searchTerm) {
                    let isHidden = true;
                    row.fields.forEach(field => {
                        if (String(field.value).toLowerCase().includes(this.searchTerm)) {
                            isHidden = false;
                        }
                    });
                    row.isHidden = isHidden;
                }

            });
            if (this.selectedRowIndexes.includes(rowIndex)) {
                row.isSelected = true;
                selectedRowCount++;
            }
            // console.log(`row = ${JSON.stringify(row)}`);
            return row;
        });
        this.rowActions.forEach(action => {
            action.isDisabled = action.isSingleRowAction ? (selectedRowCount !== 1) : (selectedRowCount === 0);
        })        
        return rows;
    }

    copyToClipboard() {
        console.log(`in copyToClipboard`);
        if (this.selectedRowIndexes.length === 1) {
            console.log(`copying to clipboard, index = ${this.selectedRowIndexes[0]}`);
            const detail = {
                sobjectRecord: this.reportDetailRecords[this.selectedRowIndexes[0]]
            };            
            // console.log(`detail = ${JSON.stringify(detail)}`);
            this.dispatchEvent(new CustomEvent(EVENTS.COPY_TO_CLIPBOARD, { detail }))
    
        }
    }

    async deleteReports() {
        console.log(`in deleteReports`);
        let recordIds = [], reportIds = [];
        let length = this.selectedRowIndexes.length;
        this.selectedRowIndexes.forEach(index => {
            let selectedRow = this.tableRows[index];
            recordIds.push(selectedRow.id);
            reportIds.push(selectedRow.reportId);
        });
        console.log(`got ${length} rows ready to delete`);
        let plural = length > 1 ? 's' : '';
        const confirmResult = await LightningConfirm.open({
            message: `Are you sure you want to delete ${length} dataset${plural}? This will not delete the underlying reports, but those reports will no longer have any data to show.`,
            label: 'Confirm Delete',
            theme: 'error',            
        });
        if (confirmResult) {
            deleteReports({ reportDetailRecordIds: recordIds, reportIds: reportIds })
                .then(() => {
                    this.dispatchEvent(new CustomEvent(EVENTS.REFRESH_RECORDS));
                    const toast = new ShowToastEvent({
                        title: `Report${plural} Successfully Deleted`,
                        message: `${length} report${plural} successfully deleted`,
                        variant: 'success',
                    });
                    this.dispatchEvent(toast);
                })
                .catch((errorMessage => {
                    console.log(`errorMessage = ${JSON.stringify(errorMessage)}`);
                    const toast = new ShowToastEvent({
                        title: 'Error Deleting Records',
                        message: `There was an error when trying to delete the report${plural}: ${errorMessage}`,
                        variant: 'error',
                    });
                    this.dispatchEvent(toast);    
                }));
        }
    }

    /* EVENT HANDLERS */
    handleColumnSort(event) {
        console.log(`in handleColumnSort: ${JSON.stringify(event.detail)}`);
        const { fieldName: sortedBy, sortDirection } = event.detail;
        const cloneData = [...this.reportDetailRecords];

        cloneData.sort(this.sortBy(sortedBy, sortDirection === 'asc' ? 1 : -1));
        this.reportDetailRecords = cloneData;
        this.sortDirection = sortDirection;
        this.sortedBy = sortedBy;
    }

    handleRowAction(event) {
        console.log(JSON.stringify(event.detail));
    }

    handleRowSelection(event) {

    }

    handleRowClick(event) {
        // console.log(`in handleRowClick`)
        // const index = Number(event.currentTarget.dataset.rowIndex);
        // console.log(`index = ${index}`);
        // console.log(JSON.stringify(this.tableRows[index]));
    }

    handleSearchChange(event) {
        console.log(`in handleSearchChange`);
        this.searchTerm = event.target.value.toLowerCase();
        return;
        const searchTerm = event.target.value;
        console.log(`searchTerm = ${searchTerm}`);
        this.tableRows.forEach((row, index) => {
            if (!searchTerm.trim()) {
                row.isHidden = false;
            } else {
                let isHidden = true;
                row.fields.forEach(field => {
                    if (String(field.value).includes(searchTerm)) {
                        console.log(`row ${index} is included because field ${field.fieldName$} value "${field.value}" contains "${searchTerm}"`);
                        isHidden = false;
                    }
                });
                row.isHidden = isHidden;
            }
        });
    }

    handleRowSelectChange(event) {
        const index = Number(event.target.dataset.rowIndex);
        const value = event.target.checked;
        if (value) {
            this.selectedRowIndexes.push(index);
        } else {
            let currentIndex = this.selectedRowIndexes.findIndex(rowIndex => rowIndex === index);
            this.selectedRowIndexes.splice(currentIndex, 1);
        }
    }

    handleSelectAllChange(event) {
        if (event.target.checked) {
            this.selectedRowIndexes = this.tableRows.map((row, index) => index);
        } else {
            this.selectedRowIndexes = [];
        }
    }

    handleNewDatasetClick() {
        const detail = {
            target: EVENTS.TARGETS.DATASET_BUILDER
        }
        this.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, { detail }));
    }


    handleRecordNameClick(event) {
        const reportDetailId = event.target.dataset.rowId;
        console.log(`reportDetailId = ${reportDetailId}`);
        let reportDetailRecord = this.reportDetailRecords.find(record => record.Id === reportDetailId);
        const detail = {
            reportDetailRecord,
            target: EVENTS.TARGETS.DATASET_BUILDER
        }
        this.dispatchEvent(new CustomEvent(EVENTS.NAVIGATE, { detail }));
    }

    /* UTILITY FUNCTIONS */
    prependNamespace(str) {
        if (this.namespace) {
            return `${this.namespace}__${str}`;
        }
        return str;
    }

    sortBy(field, reverse, primer) {
        const key = primer
            ? function (x) {
                return primer(x[field]);
            }
            : function (x) {
                return x[field];
            };

        return function (a, b) {
            a = key(a);
            b = key(b);
            return reverse * ((a > b) - (b > a));
        };
    }
}