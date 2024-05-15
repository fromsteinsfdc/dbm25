import { LightningElement, api, track } from 'lwc';

const CLASSES = {
    HIGHLIGHTED_HEADER_CELL: 'highlightedHeaderCell',
    HIGHLIGHTED_DATA_CELL: 'highlightedTableCell'
}

export default class DbmDatasetData extends LightningElement {
    @api
    get reportDetails() {
        return this._reportDetails;
    }
    set reportDetails(value) {
        this._reportDetails = JSON.parse(JSON.stringify(value));
    }
    @track _reportDetails;
    @track dragOriginCell = {};
    elementToFocusOnRerender;

    get reportDetailsString() {
        return JSON.stringify(this.reportDetails);
    }

    get has2Groupings() {
        return this.reportDetails.numGroupings == 2;
    }

    get columnHeaders() {
        return this.reportDetails.groupings[1].entries;
    }

    get rows() {
        let rows = [];
        this.reportDetails.groupings[0].entries.forEach((rowHeader, rowIndex) => {
            let newRow = {
                header: rowHeader.value,
                data: this.reportDetails.data[rowIndex].map((cell, colIndex) => {
                    return {
                        value: cell,
                        index: colIndex
                    }
                })
            };
            rows.push(newRow);
        })
        return rows;
    }

    /* LIFECYCLE HOOKS */
    renderedCallback() {
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

    handleCellValueChange(event) {
        // console.log(`in handleCellValueChange`);
        // console.log(`value = ${event.target.value}`);
        let rowIndex = event.target.dataset.rowIndex;
        // console.log(`rowIndex = ${rowIndex}`);
        let colIndex = event.target.dataset.colIndex;        
        // console.log(`colIndex = ${colIndex}`);
        this.reportDetails.data[rowIndex][colIndex] = event.target.value;
        this.dispatchDetails();
    }

    /* CELL HIGHLIGHTING COPIED OVER FROM PRIOR VERSION */
    highlightTableHeaders(colIndex, rowIndex) {
        let headerTypes = [
            { name: 'columnHeader', index: colIndex},
            { name: 'rowHeader', index: rowIndex},
        ]
        for (let headerType of headerTypes) {
            [...this.template.querySelectorAll('.' + headerType.name)].forEach((headerCell, index) => {
                if (index == headerType.index) {
                    headerCell.classList.add(CLASSES.HIGHLIGHTED_HEADER_CELL);
                } else {
                    headerCell.classList.remove(CLASSES.HIGHLIGHTED_HEADER_CELL);
                }
            });
    
        }
    }

    highlightCells(startColIndex, endColIndex, startRowIndex, endRowIndex) {
        [...this.template.querySelectorAll('.inputCell')].forEach(cell => {
            if (cell.dataset.colIndex >= startColIndex && cell.dataset.colIndex <= endColIndex && cell.dataset.rowIndex >= startRowIndex && cell.dataset.rowIndex <= endRowIndex) {
                cell.classList.add(CLASSES.HIGHLIGHTED_DATA_CELL);
            } else {
                cell.classList.remove(CLASSES.HIGHLIGHTED_DATA_CELL);
            }
        });
    }

    highlightDragCells(colIndex, rowIndex) {
        console.log('in highlightDragCells');
        let startX = Math.min(colIndex, this.dragOriginCell.x);
        let endX = Math.max(colIndex, this.dragOriginCell.x);
        let startY = Math.min(rowIndex, this.dragOriginCell.y);
        let endY = Math.max(rowIndex, this.dragOriginCell.y);
        this.highlightCells(startX, endX, startY, endY);
    }

    handleCellMouseEnter(event) {
        this.highlightTableHeaders(event.target.dataset.colIndex, event.target.dataset.rowIndex);
        if (this.dragOriginCell.x >= 0 && this.dragOriginCell.y >= 0) {
            this.highlightDragCells(event.target.dataset.colIndex, event.target.dataset.rowIndex);
        }
    }

    handleCellMouseLeave() {
        this.highlightTableHeaders();
    }

    handleCellMouseDown(event) {
        this.dragOriginCell = {
            x: event.target.dataset.colIndex,
            y: event.target.dataset.rowIndex
        }
        this.highlightDragCells(event.target.dataset.colIndex, event.target.dataset.rowIndex);
    }

    handleCellMouseUp() {
        this.dragOriginCell = {};
        this.highlightDragCells();
    }

    handleHeaderMouseEnter(event) {

    }

    /* UTILITY FUNCTIONS */
    attemptToFocus(element) {
        if (element) {
            element.focus();
        }
    }
}