import { LightningElement, api } from 'lwc';

const KEYS = {
    ESCAPE: 27
}

export default class DbmModal extends LightningElement {

    @api header;
    @api showModal = false;
    @api preventDefaultCancel = false;

    /* ACTION FUNCTIONS */
    cancelModal() {    
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    saveModal() {
        this.dispatchEvent()
    }

    /* EVENT HANDLERS */
    handleModalKeyDown(event) {
        if (event.keyCode == KEYS.ESCAPE) {
            this.cancelModal();
        }
    }

    handleCancelClick() {
        this.cancelModal();
    }

    handleSaveClick() {
        this.dispatchEvent(new CustomEvent('save'));
    }
}