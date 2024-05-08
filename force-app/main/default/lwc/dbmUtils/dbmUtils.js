const MAX_NUM_GROUPINGS = 2;

const PREVIEW_PANE_SIZES = {
    HIDDEN: 'hidden',
    SMALL: 'small',
    LARGE: 'large'
}

const METRIC_TYPES = {
    NUMBER: { label: 'Number', value: 'number', default: true },
    CURRENCY: { label: 'Currency', value: 'currency' },
    PERCENT: { label: 'Percent', value: 'percent' },
}

const METRIC_NAMES = {
    RECORD_COUNT: { label: 'Record Count', value: 'recordCount', default: true },
    REVENUE: { label: 'Revenue', value: 'revenue' },
    AMOUNT: { label: 'Amount', value: 'amount' },
    QUANTITY: { label: 'Quantity', value: 'quantity' },
    CUSTOM: { label: '--Custom--', value: 'custom' },
}

const NUM_GROUPINGS_OPTIONS = [
    { label: 'One', value: '1' },
    { label: 'Two', value: '2' },
];

const DATA_SOURCE_OPTIONS = [
    { label: 'Custom Text (default)', value: 'custom', showTextbox: true, grouping: 'Free Text', default: true },
    { label: 'Users', value: 'user', showTextbox: false, grouping: 'Pull from Salesforce' },
    { label: 'sObject Records', value: 'sobject', showTextbox: false, grouping: 'Pull from Salesforce' },
    { label: 'Picklist Field Values', value: 'picklist', showTextbox: true, grouping: 'Pull from Salesforce' },
    { label: 'Months (Jan-Dec)', value: 'months', showTextbox: true, grouping: 'Preset Values' },
    { label: 'Quarters (Q1-Q4)', value: 'quarters', showTextbox: true, grouping: 'Preset Values' },
    { label: 'Priorities (Low-Critical)', value: 'priorities', showTextbox: true, grouping: 'Preset Values' },    
];

const COLOURS = [
    '#1b96ff',
    '#ad7bee',
    '#ff538a',
    '#ff5d2d',
    '#ca8501',
    '#06a59a',
    '#7f8ced',
    '#cb65ff',
    '#fe5c4c',
    '#dd7a01',
    '#3ba755',
    '#0d9dda'
];

const VALIDATEABLE_COMPONENTS = ['input', 'lightning-input', 'lightning-combobox', 'lightning-checkbox', 'lightning-dual-listbox', 'lightning-radio-group', 'lightning-slider', 'c-fsc_object-field-selector', 'c-fsc_combobox'];


const getReportGroupings = (reportDetails) => {
    let props = Object.entries(reportDetails);
    let groupings = [];
    for (let i=0; i<reportDetails.maxNumGroupings; i++) {
        let grouping = 'grouping' + (Number(i) + 1);
        let newGrouping = {
            dataSource: transformConstantObject(DATA_SOURCE_OPTIONS).default.value,
            groupingName: grouping,
            inputLabel: 'Enter Name for Grouping #'+ (Number(i) + 1),
            isDisabled: i >= Number(reportDetails.numGroupings),
            get dataSourceIs() {
                return {
                    [this.dataSource]: true
                };
            },
        };            
        for (let [key, val] of props.filter(prop => prop[0].startsWith(grouping))) {
            newGrouping[key.replace(grouping, '')] = val;
        }
        groupings.push(newGrouping);        
    }
    return groupings;
}

const defaultReportDetails = () => {
    let reportDetails = {
        maxNumGroupings: MAX_NUM_GROUPINGS,
        numGroupings: '1',
        metricType: transformConstantObject(METRIC_TYPES).default.value,
        metricName: transformConstantObject(METRIC_NAMES).default.label,
        groupings: []
    }
    for (let i=0; i<MAX_NUM_GROUPINGS; i++) {
        reportDetails.groupings.push(newGrouping(i));
    }
    return reportDetails;
}

const newGrouping = (index) => {
    let newGrouping = {
        dataSource: transformConstantObject(DATA_SOURCE_OPTIONS).default.value,
        // get dataSourceIs() {
        //     return {
        //         [this.dataSource]: true
        //     };
        // },
    };            
    // newGrouping.isDisabled = index >= Number(reportDetails.numGroupings),
    newGrouping.inputLabel = 'Enter Name for Grouping #'+ (Number(index) + 1);
    return newGrouping;
}

const validate = () => {
    console.log('in validate');
    let allValid = true;
    for (let tagName of VALIDATEABLE_COMPONENTS) {
        console.log(this.template.querySelectorAll('*').length);
        console.log(`tagName = ${tagName}`);
        for (let el of this.template.querySelectorAll(tagName)) {
            console.log(el);
            allValid = allValid && el.reportValidity();
        }
    }
    return allValid;
}


const transformConstantObject = (constant) => {
    return {
        list: constant,
        get options() { return Object.values(this.list); },
        get default() { return this.options.find(option => option.default) || this.options[0]; },
        findFromValue: function (value) {
            let entry = this.options.find(option => option.value == value);
            return entry || this.default;
        },
        findFromLabel: function (label) {
            let entry = this.options.find(option => option.label == label);
            return entry || this.default;
        }
    }
}    

export { PREVIEW_PANE_SIZES, METRIC_TYPES, METRIC_NAMES, NUM_GROUPINGS_OPTIONS, DATA_SOURCE_OPTIONS, COLOURS, VALIDATEABLE_COMPONENTS, getReportGroupings, defaultReportDetails, newGrouping, validate, transformConstantObject };
