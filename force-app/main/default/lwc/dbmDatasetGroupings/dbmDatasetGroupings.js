import { LightningElement, api, track, wire } from 'lwc';
// import { getPicklistValues } from "lightning/uiObjectInfoApi";
import { VALIDATEABLE_COMPONENTS, NUM_GROUPINGS_OPTIONS, DATA_SOURCE_OPTIONS, getReportGroupings, transformConstantObject } from 'c/dbmUtils';
const KEYS = {
    ESCAPE: 27
}
export default class DbmDatasetGroupings extends LightningElement {

    @api
    get reportDetails() {
        return this._reportDetails;
    }
    set reportDetails(value) {
        this._reportDetails = JSON.parse(JSON.stringify(value));
    }
    @track _reportDetails;

    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    elementToFocusOnRerender;

    /* New cell focus management */
    get cellToFocusElement() {
        return this.template.querySelector(`.inputElement[data-grouping-index="${this.cellToFocus.groupingIndex}"][data-entry-index="${this.cellToFocus.entryIndex}"]`);
    }
    cellToFocus;

    /* Bulk add modal management */
    get bulkAddTextareaElement() {
        return this.template.querySelector('.bulkAddTextarea');
    }
    showBulkAddModal = false;
    modalRendered = false;
    currentOpenModalIndex;

    /* LIFECYCLE HOOKS */
    connectedCallback() {
        this.reportDetails.groupings.forEach((grouping, groupingIndex) => {
            if (grouping.presetEntries?.length) {
                grouping.presetEntries.forEach(presetValue => {
                    this.addEntry(groupingIndex, presetValue);
                })
                // grouping.entries = grouping.presetEntries.map(entry => this.newEntry(entry));
                grouping.presetEntries = [];
            }
            if (grouping.entries.length === 0) {
                this.addEntry(groupingIndex);
            }
            this.dispatchDetails();
            // if (!grouping.entries.some(entry => {
            //     return entry.value;
            // })) {
            //     if (grouping.presetEntries?.length) {
            //         grouping.presetEntries.forEach(presetValue => {
            //             this.addEntry(groupingIndex, presetValue);
            //         })
            //         // grouping.entries = grouping.presetEntries.map(entry => this.newEntry(entry));
            //         grouping.presetEntries = [];
            //     } else {
            //         // grouping.entries = [this.newEntry()];
            //         this.addEntry(groupingIndex);
            //     }
            //     this.dispatchDetails();
            // }
        })
    }

    renderedCallback() {
        // If the modal has just opened, focus on the textarea element
        if (this.bulkAddTextareaElement && !this.modalRendered) {
            this.bulkAddTextareaElement.focus();
            this.modalRendered = true;
        }
        if (this.cellToFocus && this.cellToFocusElement) {
            this.cellToFocusElement.focus();
            this.cellToFocus = null;
        }
        if (this.elementToFocusOnRerender) {
            this.attemptToFocus(this.elementToFocusOnRerender);
            this.elementToFocusOnRerender = null;
        }
    }

    /* ACTION FUNCTIONS */
    dispatchDetails() {
        const detail = this.reportDetails;
        this.dispatchEvent(new CustomEvent('reportdetailchange', { detail }));
    }

    closeBulkAddModal() {
        this.showBulkAddModal = false;
        this.modalRendered = false;
        this.template.querySelector('.bulkAddEntriesButton').focus();
    }

    addEntry(groupingIndex, entryValue, ignoreFocus) {
        this.reportDetails.groupings[groupingIndex].entries.push(this.newEntry(entryValue));
        this.cellToFocus = { groupingIndex, entryIndex: this.reportDetails.groupings[groupingIndex].entries.length - 1 };
        /* Add data */
        if (this.reportDetails.groupings[groupingIndex].entries.length > 1) {
            const len1 = this.reportDetails.data.length;
            const len2 = this.reportDetails.data[0].length;
            if (groupingIndex === 0) {
                let newRow = [];
                for (let i = 0; i < len2; i++) {
                    newRow.push(null);
                }
                this.reportDetails.data.push(newRow);
            }
            if (groupingIndex === 1) {
                this.reportDetails.data.forEach(column => {
                    column.push(null);
                })
            }
        }
    }

    removeEntry(groupingIndex, entryIndex, showConfirm) {
        this.reportDetails.groupings[groupingIndex].entries.splice(entryIndex, 1);
        if (groupingIndex === 0) {
            this.reportDetails.data.splice(entryIndex, 1);
        }
        if (groupingIndex === 1) {
            this.reportDetails.data.forEach(column => {
                column.splice(entryIndex, 1);
            })
        }
    }

    /* EVENT HANDLERS */
    handleAddEntryClick(event) {
        let index = Number(event.target.dataset.index);
        // this.reportDetails.groupings[index].entries.push(this.newEntry());
        this.addEntry(index);
        this.dispatchDetails();
    }

    handleEntryRecordChange(event) {
        console.log(`in dbmGroupings handleEntryRecordChange`);

        console.log(JSON.stringify(event.detail));
        let eventData = this.getDataFromEvent(event);
        eventData.entry.recordId = event.detail.value;
        eventData.entry.value = event.detail.selectedRecord.label;

        // const groupingIndex = Number(event.target.dataset.groupingIndex);
        // const entryIndex = Number(event.target.dataset.entryIndex);
        // this.reportDetails.groupings[groupingIndex].entries[entryIndex].recordId = event.detail.value;
        // this.reportDetails.groupings[groupingIndex].entries[entryIndex].value = event.detail.selectedRecord.label;
        this.dispatchDetails();
    }

    handleEntryTextChange(event) {
        let eventData = this.getDataFromEvent(event);
        eventData.entry.value = event.detail.value;
        // const groupingIndex = Number(event.target.dataset.groupingIndex);
        // const entryIndex = Number(event.target.dataset.entryIndex);
        // this.reportDetails.groupings[groupingIndex].entries[entryIndex].value = event.detail.value;
        this.dispatchDetails();
    }

    handleEntryDeleteClick(event) {
        let eventData = this.getDataFromEvent(event);
        // eventData.grouping.entries.splice(eventData.entryIndex, 1);
        this.removeEntry(eventData.groupingIndex, eventData.entryIndex);
        // const groupingIndex = Number(event.target.dataset.groupingIndex);
        // const entryIndex = Number(event.target.dataset.entryIndex);
        // this.reportDetails.groupings[groupingIndex].entries.splice(entryIndex, 1);
        if (eventData.grouping.entries.length === 0) {
            // eventData.grouping.entries = [this.newEntry()];
            this.addEntry(eventData.groupingIndex);
        }
        this.dispatchDetails();
    }

    handleBulkAddClick(event) {
        this.showBulkAddModal = true;
        this.currentOpenModalIndex = Number(event.target.dataset.index);
    }

    handleBulkAddModalKeydown(event) {
        if (event.keyCode == KEYS.ESCAPE) {
            this.closeBulkAddModal();
        }
    }

    handleBulkAddModalSaveClick() {
        let lines = this.bulkAddTextareaElement.value.split(/\n/);
        let grouping = this.reportDetails.groupings[this.currentOpenModalIndex];
        let lineCount = 0;
        lines.forEach(line => {
            if (line) {
                // grouping.entries.push(this.newEntry(line));
                this.addEntry(this.currentOpenModalIndex, line);
                lineCount++;
            }
        });
        // If the bulk add was done with a blank first entry, remove that entry after the bulk add
        if (grouping.entries.length === lineCount + 1 && !grouping.entries[0].value) {
            // grouping.entries.shift();
            this.removeEntry(this.currentOpenModalIndex, 0);
        }
        this.closeBulkAddModal();
        this.dispatchDetails();
    }

    /* UTILITY FUNCTIONS */
    getDataFromEvent(event) {
        const groupingIndex = Number(event.target.dataset.groupingIndex);
        const entryIndex = Number(event.target.dataset.entryIndex);
        let grouping = this.reportDetails.groupings[groupingIndex];
        let entry;
        if (grouping && grouping.entries) {
            entry = grouping.entries[entryIndex];
        }
        let data = {
            groupingIndex,
            entryIndex,
            grouping,
            entry
        };
        // console.log(`returning data from getDataFromEvent: ${JSON.stringify(data)}`);
        return data;

    }

    newEntry(value) {
        return {
            value
        };
    }

    @api validate() {
        let allValid = true;
        for (let tagName of VALIDATEABLE_COMPONENTS) {
            for (let el of this.template.querySelectorAll(tagName)) {
                allValid = el.reportValidity() && allValid;
            }
        }
        return allValid;
    }

    attemptToFocus(element) {
        if (element) {
            element.focus();
        }
    }
}