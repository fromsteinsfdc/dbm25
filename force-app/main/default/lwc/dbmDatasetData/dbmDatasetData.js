import { LightningElement, api, track } from 'lwc';
import { switchGroupings } from "c/dbmUtils";

const CLASSES = {
    HIGHLIGHTED_HEADER_CELL: 'highlightedHeaderCell',
    HIGHLIGHTED_DATA_CELL: 'highlightedTableCell',
    INPUT_CELL: 'inputCell',
    HIGHLIGHTED: 'highlighted',
    HIGHLIGHTABLE: 'highlightable',
    SELECTED: 'selected',
}
export default class DbmDatasetData extends LightningElement {
    @api
    get reportDetails() {
        return this._reportDetails;
    }
    set reportDetails(value) {
        this._reportDetails = JSON.parse(JSON.stringify(value));
    }

    @api
    preventClearSelection() {
        return this.showRandomizeModal;
    }

    @track _reportDetails;
    @track dragOriginCell = {};
    @track dragOriginHeader = {};
    // @track activeDrag;
    elementToFocusOnRerender;
    saveBlanksAsZeroes = false;
    showRandomizeModal = false;
    randomizeModal;

    connectedCallback() {
        // window.addEventListener('mouseup', () => {
        //     this.handleGlobalMouseUp();
        // });
        if (!this.randomizeModal) {
            this.randomizeModal = {
                lowerBound: 0,
                upperBound: 100,
                numDecimals: 0,
                selectedOnly: true,
                overwrite: true
            }
        }
    }

    get saveBlankButton() {
        if (this.saveBlanksAsZeroes) {
            return {
                label: 'Blank values will be saved as zeroes',
                iconName: 'utility:check',
                variant: 'brand'
            }
        } else {
            return {
                label: 'Blank values will not be saved',
                iconName: 'utility:close',
                variant: 'neutral'
            }
        }
    }

    get placeholder() {
        return this.saveBlanksAsZeroes ? 0 : null;
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

    get allInputCells() {
        return this.template.querySelectorAll(`.${CLASSES.INPUT_CELL}`);
    }

    get selectedInputCells() {
        return this.template.querySelectorAll(`.${CLASSES.INPUT_CELL}.${CLASSES.SELECTED}`);
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

    selectHighlightedElements() {
        [...this.template.querySelectorAll(`.${CLASSES.HIGHLIGHTABLE}`)].forEach(el => {
            if (el.classList.contains(CLASSES.HIGHLIGHTED)) {
                el.classList.add(CLASSES.SELECTED);
                el.classList.remove(CLASSES.HIGHLIGHTED);
            }
        });
    }

    @api
    clearSelectedElements() {
        this.dragOriginCell = {};
        this.dragOriginHeader = {};
        [...this.template.querySelectorAll(`.${CLASSES.SELECTED}`)].forEach(el => {
            el.classList.remove(CLASSES.SELECTED);
        });
    }

    highlightTableHeaders(startColIndex, endColIndex, startRowIndex, endRowIndex) {
        let headerTypes = [
            { name: 'columnHeader', startIndex: startColIndex, endIndex: endColIndex },
            { name: 'rowHeader', startIndex: startRowIndex, endIndex: endRowIndex },
        ]
        for (let headerType of headerTypes) {
            [...this.template.querySelectorAll('.' + headerType.name)].forEach((headerCell, index) => {
                if (index >= headerType.startIndex && index <= headerType.endIndex) {
                    headerCell.classList.add(CLASSES.HIGHLIGHTED);
                } else {
                    headerCell.classList.remove(CLASSES.HIGHLIGHTED);
                }
            });

        }
    }

    highlightCells(startColIndex, endColIndex, startRowIndex, endRowIndex) {
        [...this.template.querySelectorAll('.inputCell')].forEach(cell => {
            if (cell.dataset.colIndex >= startColIndex && cell.dataset.colIndex <= endColIndex && cell.dataset.rowIndex >= startRowIndex && cell.dataset.rowIndex <= endRowIndex) {
                cell.classList.add(CLASSES.HIGHLIGHTED);
            } else {
                cell.classList.remove(CLASSES.HIGHLIGHTED);
            }
        });
    }

    highlightDragCells(colIndex, rowIndex) {
        // console.log('in highlightDragCells');
        let startX = Math.min(colIndex, this.dragOriginCell.x);
        let endX = Math.max(colIndex, this.dragOriginCell.x);
        let startY = Math.min(rowIndex, this.dragOriginCell.y);
        let endY = Math.max(rowIndex, this.dragOriginCell.y);
        this.highlightCells(startX, endX, startY, endY);
        this.highlightTableHeaders(startX, endX, startY, endY);
    }

    /* EVENT HANDLERS */
    handleCellValueChange(event) {
        let rowIndex = event.target.dataset.rowIndex;
        let colIndex = event.target.dataset.colIndex;
        this.reportDetails.data[rowIndex][colIndex] = event.target.value;
        this.dispatchDetails();
    }

    handleSwitchGroupingsClick() {
        this.reportDetails = switchGroupings(this.reportDetails);
        this.dispatchDetails();
    }

    handleSaveBlanksClick() {
        event.stopPropagation();
        event.preventDefault();
        this.saveBlanksAsZeroes = !this.saveBlanksAsZeroes;
    }

    handleCellMouseEnter(event) {
        this.highlightTableHeaders(event.target.dataset.colIndex, event.target.dataset.colIndex, event.target.dataset.rowIndex, event.target.dataset.rowIndex);
        if (this.dragOriginCell.x >= 0 && this.dragOriginCell.y >= 0) {
            this.highlightDragCells(event.target.dataset.colIndex, event.target.dataset.rowIndex);
        }
    }

    handleCellMouseLeave() {
        this.highlightCells();
        this.highlightTableHeaders();
    }

    handleCellMouseDown(event) {
        // event.preventDefault();
        // event.stopPropagation();
        this.clearSelectedElements();
        this.dragOriginCell = {
            x: event.target.dataset.colIndex,
            y: event.target.dataset.rowIndex
        }
        this.highlightDragCells(event.target.dataset.colIndex, event.target.dataset.rowIndex);
    }

    handleCellFocus(event) {
        console.log(`focusing on cell ${event.target.dataset.colIndex}/${event.target.dataset.rowIndex}`);
    }

    // handleCellMouseUp(event) {
    //     event.stopPropagation();
    //     event.preventDefault();
    //     this.selectHighlightedElements();
    //     this.dragOriginCell = {};
    //     this.dragOriginHeader = {};
    //     // this.dragOriginCell = {};
    //     // this.highlightDragCells();
    // }

    handleHeaderMouseEnter(event) {
        event.stopPropagation();
        event.preventDefault();
        const el = event.target;
        // if (this.dragOriginHeader.dragType) {

        // } else {
        if ('rowIndex' in el.dataset) {
            if (this.dragOriginHeader.dragType === 'col') {
                return;
            }
            let startIndex = this.dragOriginHeader.dragType === 'row' ? Math.min(el.dataset.rowIndex, this.dragOriginHeader.index) : el.dataset.rowIndex;
            let endIndex = this.dragOriginHeader.dragType === 'row' ? Math.max(el.dataset.rowIndex, this.dragOriginHeader.index) : el.dataset.rowIndex;
            // this.highlightCells(0, this.reportDetails.data[0].length, el.dataset.rowIndex, el.dataset.rowIndex);                
            this.highlightCells(0, this.reportDetails.data[0].length, startIndex, endIndex);
            this.highlightTableHeaders(undefined, undefined, startIndex, endIndex);
        }
        if ('colIndex' in el.dataset) {
            if (this.dragOriginHeader.dragType === 'row') {
                return;
            }
            let startIndex = this.dragOriginHeader.dragType === 'col' ? Math.min(el.dataset.colIndex, this.dragOriginHeader.index) : el.dataset.colIndex;
            let endIndex = this.dragOriginHeader.dragType === 'col' ? Math.max(el.dataset.colIndex, this.dragOriginHeader.index) : el.dataset.colIndex;

            // this.highlightCells(el.dataset.colIndex, el.dataset.colIndex, 0, this.reportDetails.data.length);
            this.highlightCells(startIndex, endIndex, 0, this.reportDetails.data.length);
            this.highlightTableHeaders(startIndex, endIndex, undefined, undefined);

        }
        // }
    }

    handleHeaderMouseLeave(event) {
        this.highlightCells();
        this.highlightTableHeaders();
    }

    handleHeaderMouseDown(event) {
        event.stopPropagation();
        event.preventDefault();
        this.clearSelectedElements();
        const el = event.currentTarget;
        this.dragOriginHeader = {
            dragType: el.scope,
            index: el.dataset[`${el.scope}Index`]
        }
    }

    handleTableMouseUp(event) {
        event.stopPropagation();
        event.preventDefault();
        this.selectHighlightedElements();
        this.dragOriginCell = {};
        this.dragOriginHeader = {};
    }

    handleRandomizeClick() {
        event.stopPropagation();
        event.preventDefault();
        this.showRandomizeModal = true;
    }

    handleRandomizeModalCancel() {
        this.showRandomizeModal = false;
    }

    handleRandomizeModalSave() {
        Object.keys(this.randomizeModal).forEach(property => {
            console.log(`looking for ${property}`);
            let el = this.template.querySelector(`[data-property="${property}"]`);
            console.log(`${el.tagName}, ${el.dataset.property}, ${el.value}`);
            if (el) {
                if (el.type === 'toggle' || el.type === 'checkbox') {
                    this.randomizeModal[property] = el.checked;
                } else if (el.type === 'number') {
                    this.randomizeModal[property] = Number(el.value);
                } else {
                    this.randomizeModal[property] = el.value;    
                }
            }
        });
        let mod = this.randomizeModal;

        let inputCells = [...(mod.selectedOnly ? this.selectedInputCells : this.allInputCells)];
                
        let changedCount = 0;
        inputCells.forEach(cell => {
            if (cell.value.trim().length === 0 || mod.overwrite) {
                let ran = (Math.random() * (mod.upperBound - mod.lowerBound) + mod.lowerBound).toString();
                ran = Number(ran.substring(0, (ran.indexOf('.') + Number(mod.numDecimals) + 1)));
                this.reportDetails.data[cell.dataset.rowIndex][cell.dataset.colIndex] = ran;
                changedCount++;
            } else {
                // console.log(`skipping cell because overwrite condition not met`);
            }
        });
        if (changedCount > 0) {
            this.dispatchDetails();
        }
        this.showRandomizeModal = false;
    }

    /* UTILITY FUNCTIONS */
    attemptToFocus(element) {
        if (element) {
            element.focus();
        }
    }

    /*
    handleGlobalMouseUp(event) {
        console.log(`in handleGlobalMouseUp`);
        this.selectHighlightedElements();
        this.dragOriginCell = {};
        this.dragOriginHeader = {};
    }
    */

    /*
    startDrag(x, y) {
        this.activeDrag = {
            originX: x,
            originY: y,
            currentX: x,
            currentY: y,
        };
        if (x === undefined) {
            this.activeDrag.isRowDrag = true;
        } if (y === undefined) {
            this.activeDrag.isColDrag = true;
        } else {
            this.activeDrag.isCellDrag = true;
        }
    }

    endDrag() {
        this.dragOrigin = undefined;
    }

    highlightableMouseEnter(event) {
        const el = event.target;
        let x = el.dataset.colIndex;
        let y = el.dataset.rowIndex;
        if (this.activeDrag) {
            if (el.tagName === 'th') {
                if (('rowIndex' in el.dataset && this.activeDrag.isRowDrag) || ('colIndex' in el.dataset && this.activeDrag.isColDrag)) {
                    this.highlightDragCells(x, y);
                }
            } else {
                this.highlightDragCells(x, y);
            }
        } else {
            if (el.tagName === 'th') {

            }
            if (CLASSES.INPUT_CELL in el.classList) {

            }
        }
    }

    highlightableMouseDown(event) {
        this.startDrag(event.target.dataset.colIndex, event.target.dataset.rowIndex);
    }
    */
}