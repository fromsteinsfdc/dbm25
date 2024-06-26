import { LightningElement, wire, track, api } from 'lwc';
import getObjects from '@salesforce/apex/ObjectFieldSelectorController.getObjects';
import { DISPLAY_TYPE_OPTIONS, AVAILABLE_OBJECT_OPTIONS, FIELD_TYPES, LAYOUT_OPTIONS, transformConstantObject } from 'c/fsc_objectFieldSelectorUtils';
import { setValuesFromMultipleInput, setValuesFromSingularInput, CLEAR_REQUEST_EVENT_NAME } from 'c/fsc_comboboxUtils';

const ANCILLARY_SUFFIXES = ['Feed', 'Tag', 'Share', 'ChangeEvent', 'History'];
const COMBOBOX_COMPONENT_NAME = 'c-fsc_combobox';
export default class Fsc_objectSelector extends LightningElement {
    availableObjectOptions = transformConstantObject(AVAILABLE_OBJECT_OPTIONS);

    @api name;
    @api allowMultiselect = false;
    @api required = false;
    @api label = 'Select Object';
    @api placeholder = 'Type to search objects';
    @api showSelectedCount;
    @api publicClass;
    @api publicStyle;
    @api fieldLevelHelp;
    @api variant;
    @api hideIcons = false;
    @api valueDelimiter = ',';
    @api isLoading = false;
    @api disabled = false;
    @api hidePills = false; // If true, list of selected pills in multiselect mode will not be displayed (generally because a parent component wants to display them differently).
    @api excludeSublabelInFilter = false;   // If true, the 'sublabel' text of an option is not included when determining if an option is a match for a given search text.
    @api includeValueInFilter = false;  // If true, the 'value' text of an option is included when determining if an option is a match for a given search text.    
    @api notifyOnClear = false;
    // @api availableObjectSelection = this.availableObjectOptions.default?.value;
    @api availableObjects = [];
    
    @api builderContext;

    hasConnected = false;
    @track allOptions = [];
    @track loadedCategories = [];

    @api
    get values() {
        return this._values || [];
    }
    set values(values) {
        this._values = setValuesFromMultipleInput(values);
    }
    @track _values = [];

    @api
    get value() {
        return this.values.join(this.valueDelimiter);
    }
    set value(value) {
        this.values = setValuesFromSingularInput(value, this.valueDelimiter, this.allowMultiselect);
    }

    @api
    get availableObjectSelection() {
        return this._availableObjectSelection;
    }
    set availableObjectSelection(value) {
        // console.log(' in set availableObjectSelection to ' + value);
        this._availableObjectSelection = value;
        if (this.hasConnected && this.values.length) {
            this.values = [];
            this.dispatchObjects();
        }
        // if (!this.loadedCategories.includes(this.availableObjectSelection)) {
        //     this.loadObjectCategory(this.availableObjectSelection);
        // }
    }
    _availableObjectSelection = this.availableObjectOptions.default?.value;

    get objectOptions() {
        return this.allOptions.filter(option => {
            if (this.availableObjectSelection === AVAILABLE_OBJECT_OPTIONS.SPECIFIC.value) {
                return this.availableObjects?.includes(option.value);
            } else {
                return this.matchesObjectCategory(option.category);
            }
        });
    }

    get computedPlaceholder() {
        return this.isLoading ? 'Loading...' : this.placeholder;
    }

    get combobox() {
        return this.template.querySelector(COMBOBOX_COMPONENT_NAME);
    }

    // @api
    // get availableObjects() {
    //     return this._availableObjects;
    // }
    // set availableObjects(value) {
    //     this._availableObjects = value;
    //     if(this.hasConnected)
    //         this.loadObjects();
    // }
    // _availableObjects = []

    addObjectOptions(options, category) {
        let newOptions = options.map(objectType => {
            return {
                category,
                label: objectType.label,
                sublabel: objectType.value,
                value: objectType.value,
            }
        });
        this.allOptions = [...this.allOptions, ...newOptions].sort((a, b) => {
            return a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1;
        });
    }

    loadObjectCategory(category) {
        // if (!this.value) {
        //     this.isLoading = true;
        // }
        getObjects({ selectionType: category })
            .then(result => {
                this.addObjectOptions(result.objects, category);
                if (!this.value || this.objectOptions.find(option => option.value == this.value)) {
                    this.isLoading = false;
                }
            });
    }

    @api
    reportValidity() {
        return this.combobox.reportValidity();
    }

    @api
    validate() {
        return this.combobox.validate();
    }

    @api
    clearSelection() {
        this.combobox.clearSelection();
    }

    connectedCallback() {
        this.hasConnected = true;
        this.isLoading = true;
        let initialLoadCategories = [AVAILABLE_OBJECT_OPTIONS.STANDARD.value, AVAILABLE_OBJECT_OPTIONS.CUSTOM.value, AVAILABLE_OBJECT_OPTIONS.ANCILLARY.value];
        initialLoadCategories.forEach(category => {
            this.loadObjectCategory(category);
        });
    }

    handleComboboxChange(event) {
        this.values = event.detail.values;
        this.dispatchObjects();
    }

    handleClearRequest() {
        console.log(`in objectSelector handleClearRequest`);
        this.dispatchEvent(new CustomEvent(CLEAR_REQUEST_EVENT_NAME));
    }

    dispatchObjects() {
        let detail = {
            value: this.value,
            values: this.values,
        }
        this.dispatchEvent(new CustomEvent('change', { detail }));
    }

    matchesObjectCategory(category) {
        return category === this.availableObjectSelection ||
            this.availableObjectSelection === AVAILABLE_OBJECT_OPTIONS.ALL.value ||
            (this.availableObjectSelection === AVAILABLE_OBJECT_OPTIONS.BOTH.value && (category === AVAILABLE_OBJECT_OPTIONS.STANDARD.value || category === AVAILABLE_OBJECT_OPTIONS.CUSTOM.value))
    }
}