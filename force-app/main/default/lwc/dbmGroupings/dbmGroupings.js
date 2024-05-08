import { LightningElement, api, track } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import { NUM_GROUPINGS_OPTIONS, DATA_SOURCE_OPTIONS, getReportGroupings, transformConstantObject } from 'c/dbmUtils';

export default class DbmGroupings extends LightningElement {
    @api reportDetails;
    @track groupingColumns = [];

    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    get groupings() {
        return getReportGroupings(this.reportDetails);
    }

    async confirmClear() {
        console.log(`in confirmClear`);
        const result = await LightningConfirm.open({
            message: 'this is the prompt message',
            variant: 'headerless',
            label: 'this is the aria-label value',
            // setting theme would have no effect
        });
        return result;
    }

    // get groupingColumns() {
    //     let columns = [];
    //     for (let i=0; i<this.reportDetails.maxNumGroupings; i++) {
    //         let classList = ['slds-col'];
    //         if (i < this.reportDetails.numGroupings) {
    //             classList.push(`slds-size_1-of-${this.reportDetails.numGroupings}`);
    //         } else {
    //             classList.push('slds-hide');
    //         }
    //         let column = {
    //             grouping: this.groupings[i],
    //             classString: classList.join(' '),
    //             entries: []
    //         }
    //         columns.push(column);
    //     }
    //     console.log(`groupingColumns = ${JSON.stringify(columns)}`);
    //     return columns;
    // }

    connectedCallback() {
        this.setColumns();
    }

    setColumns() {
        let columns = [];
        for (let i=0; i<this.reportDetails.maxNumGroupings; i++) {
            let classList = ['slds-col'];
            if (i < this.reportDetails.numGroupings) {
                classList.push(`slds-size_1-of-${this.reportDetails.numGroupings}`);
            } else {
                classList.push('slds-hide');
            }
            let column = {
                grouping: this.groupings[i],
                classString: classList.join(' '),
                entries: [this.newEntry()]
            }
            columns.push(column);
        }
        console.log(`groupingColumns = ${JSON.stringify(columns)}`);
        this.groupingColumns = columns;
    }

    newEntry() {
        return {};
    }

    handleAddEntryClick(event) {
        let index = Number(event.target.dataset.index);
        this.groupingColumns[index].entries.push(this.newEntry());
    }

    // get grouping1ColumnClass() {
    //     return (this.reportDetails.numGroupings == 1) ? 'slds-size_1-of-1' : 'slds-size_1-of-2';
    // }

    // get grouping2ColumnClass() {
    //     return (this.reportDetails.numGroupings == 1) ? 'slds-hide' : 'slds-size_1-of-2';
    // }
}