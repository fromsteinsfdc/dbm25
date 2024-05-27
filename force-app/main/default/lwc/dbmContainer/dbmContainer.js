import { LightningElement } from 'lwc';

const MENU_PANEL_OPTIONS = [
    { name: 'new', label: 'Build Dataset', iconName: 'utility:record_create' },
    { name: 'existing', label: 'View Existing Datasets', iconName: 'utility:record_alt' },
    { name: 'settings', label: 'Settings', iconName: 'utility:settings' },
    { name: 'help', label: 'Help', iconName: 'utility:help_center' },
]

export default class DbmContainer extends LightningElement {
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

    get activePanelIs() {
        return {
            [this.selectedMenuPanelOption]: true
        }
    }

    /* LIFECYCLE HOOKS */
    connectedCallback() {
        // Initiate all menu panel options
        this.menuPanelOptions = MENU_PANEL_OPTIONS.map((option, index) => {
            return this.newMenuPanelOption(option, index === 0);
        });
        this.selectMenuPanelOption(this.menuPanelOptions[0].name);
        console.log(JSON.stringify(this.menuPanelOptions));
    }

    /* ACTION FUNCTIONS */
    selectMenuPanelOption(optionName) {
        console.log(`in selectMenuPanelOption, selecting "${optionName}"`);
        this.selectedMenuPanelOption = optionName;
        this.menuPanelOptions.forEach((option) => {
            option.isSelected = option.name === optionName;
        })
        this.menuPanelOptions = this.menuPanelOptions.map(option => option);
    }

    /* EVENT HANDLERS */
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

    handleReportDetailChange(event) {
        console.log(`in dbmContainer, reportDetails: ${JSON.stringify(event.detail)}`);
    }

    /* UTILITY FUNCTIONS */
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
}