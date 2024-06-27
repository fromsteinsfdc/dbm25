public with sharing class DBM25Controller {

    public class DBM25Exception extends Exception {}
    public static final Integer apiNameMaxLength = 40;
    public static final String userObjectPrefix = '005';
    public static final String SUCCESS = 'success';
    public static final String ERROR = 'error';
    public static final String METRIC_TYPE_PERCENT = 'percent';
    public static final String METRIC_TYPE_NUMBER = 'number';
    public static final String notificationEmail = 'dashboardmagic@gmail.com';
    
    public static String packageNamespace;
    
    public static DescribeSObjectResult reportObjRes = DBM_Report__c.getSObjectType().getDescribe();
    public static DescribeSObjectResult dataEntryObjRes = DBM_Data_Entry__c.getSObjectType().getDescribe();
    public static DescribeFieldResult reportFieldRes = DBM_Data_Entry__c.Report__c.getDescribe();
    public static DescribeFieldResult valueFieldRes = DBM_Data_Entry__c.Value__c.getDescribe();
    public static DescribeFieldResult grouping1FieldRes = DBM_Data_Entry__c.Grouping_1__c.getDescribe();
    public static DescribeFieldResult grouping2FieldRes = DBM_Data_Entry__c.Grouping_2__c.getDescribe();
    public static DescribeFieldResult grouping1OrderFieldRes = DBM_Data_Entry__c.Grouping_1_Order__c.getDescribe();
    public static DescribeFieldResult grouping2OrderFieldRes = DBM_Data_Entry__c.Grouping_2_Order__c.getDescribe();

    /* Will possibly use some of these fields in the future for displaying the grouping headings as links, 
    but those links don't show up on dashboard charts anyway, so I'm not prioritizing it */
    // public static DescribeFieldResult grouping1DisplayLabelFieldRes = DBM_Data_Entry__c.Grouping_1_Display_Label__c.getDescribe();
    // public static DescribeFieldResult grouping2DisplayLabelFieldRes = DBM_Data_Entry__c.Grouping_2_Display_Label__c.getDescribe();
    // public static DescribeFieldResult grouping1LinkToRecordFieldRes = DBM_Data_Entry__c.Grouping_1_Link_to_Record__c.getDescribe();
    // public static DescribeFieldResult grouping2LinkToRecordFieldRes = DBM_Data_Entry__c.Grouping_2_Link_to_Record__c.getDescribe();
    // public static DescribeFieldResult grouping1UserFieldRes = DBM_Data_Entry__c.Grouping_1_User__c.getDescribe();
    // public static DescribeFieldResult grouping2UserFieldRes = DBM_Data_Entry__c.Grouping_2_User__c.getDescribe();

    // I don't know if I'm doing this right, but I read that this is a way to reduce how often getGlobalDescribe needs to be called to improve performance
    public static Map<String, SObjectType> globalDescribe {
        get { 
            if (globalDescribe == null) {
                return Schema.getGlobalDescribe();
            }
            return globalDescribe;
        }
    }

    // Retrieves the package namespace, if applicable, and returns it for use in the LWCs
    @AuraEnabled(cacheable=true)
    public static String getPackageNamespace() {
        if (String.isBlank(packageNamespace)) {
            String namespacePrefix = '';
            String[] classNameParts = String.valueOf(DBM25Controller.class).split('\\.', 2);
            if(classNameParts.size() > 1) {
                Type classType = Type.forName(classNameParts[0], classNameParts[1]);
                if(classType == DBM25Controller.class) {
                    namespacePrefix = classNameParts[0];
                } else {
                    namespacePrefix = '';
                }
            }        
            packageNamespace = namespacePrefix;            
        }
        return packageNamespace;
    }

    @AuraEnabled
    public static List<String> getPicklistValues(String objectName, String fieldName) {
        List<String> picklistLabels = new List<String>();        
        try {
            Schema.DescribeSObjectResult objDescribeSobject = globalDescribe.get(objectName).getDescribe();            
            Schema.DescribeFieldResult fieldResult = objDescribeSobject.fields.getMap().get(fieldName).getDescribe();
            
            for (Schema.PicklistEntry pickListVal : fieldResult.getPicklistValues()) {
                picklistLabels.add(picklistVal.getLabel());
            }
        } catch (Exception e) {
            System.debug('Error: '+ e.getMessage());
        }
        return picklistLabels;
    }

    @AuraEnabled
    public static List<Folder> getReportFolders(){
        try {
            return [SELECT Name, DeveloperName, NamespacePrefix FROM Folder WHERE Type = 'Report' AND DeveloperName != '' ORDER BY Name ASC];
        } catch (Exception e) {
            System.debug('Error fetching report folders: '+ e.getMessage());
            return null;
        }
    }

    @AuraEnabled
    public static List<DBM_Report__c> getReportDetailRecords() {
        List<DBM_Report__c> reportDetailRecords = [SELECT 
            Id, Name, Metric_Label__c, Metric_Type__c, Number_of_Groupings__c, Report_Folder_name__c, Report_ID__c, LastModifiedDate, CreatedDate,
            (SELECT Name, Id, Grouping_Number__c, Data_Source__c, Object_Name__c, Field_Name__c, Display_as_Link__c FROM DBM_Report_Groupings__r ORDER BY Grouping_Number__c ASC), 
            (SELECT Name, Id, Grouping__c, Grouping_Order__c, Record_ID__c, User__c FROM DBM_Report_Grouping_Entries__r ORDER BY Grouping_Order__c ASC),
            (SELECT Id, Name, Value__c, Grouping_1__c, Grouping_2__c FROM DBM_Data_Entries__r) 
            FROM DBM_Report__c ORDER BY LastModifiedDate DESC];
        return reportDetailRecords;
    }

    @AuraEnabled
    public static String deleteReports(List<Id> reportDetailRecordIds, List<Id> reportIds){
        try {
            delete [SELECT Id FROM DBM_Report__c WHERE Id IN: reportDetailRecordIds];
            // delete [SELECT Id FROM Report WHERE Id IN: reportIds];
            return null;
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    @AuraEnabled
    public static Map<String, Object> saveReportDetails(String reportDetailsString) {
        Map<String, Object> returnMap = new Map<String, Object>();
        try {
            // Deserialize the `reportDetails` JSON object into a map of Apex objects
            Map<String, Object> requestObject = (Map<String, Object>)JSON.deserializeUntyped(reportDetailsString);
            
            // Delete any existing child records from the report, if it exists
            List<DBM_Report__c> existingReports = [SELECT Id FROM DBM_Report__c WHERE Id =: (String)requestObject.get('id')];
            if (existingReports.size() > 0) {
                delete [SELECT Id FROM DBM_Report_Grouping__c WHERE Report__c =: existingReports[0].Id];
                delete [SELECT Id FROM DBM_Data_Entry__c WHERE Report__c =: existingReports[0].Id];
            }

            // Define and insert the DBM_Report__c record with values from the request
            DBM_Report__c newReport = new DBM_Report__c();
            newReport.Id = (String)requestObject.get('id');
            newReport.Name = (String)requestObject.get('reportName');
            newReport.Metric_Label__c = (String)requestObject.get('metricLabel');
            newReport.Metric_Type__c = (String)requestObject.get('metricType');
            newReport.Report_Folder_name__c = (String)requestObject.get('folderDeveloperName');
            // insert newReport;
            upsert newReport;

            // Define the list of new DBM_Report_Grouping__c records
            List<DBM_Report_Grouping__c> newGroupings = new List<DBM_Report_Grouping__c>();
            // Define a map of grouping names to the list of grouping entries, so that we can populate the lookup IDs later on
            Map<String, List<DBM_Report_Grouping_Entry__C>> groupingEntryMap = new Map<String, List<DBM_Report_Grouping_Entry__C>>();
            // Loop through the groupings
            for (Object grouping : (List<Object>)requestObject.get('groupings')) {
                Map<String, Object> groupingObject = (Map<String, Object>) grouping;
                // If this grouping is disabled, skip it
                if (Boolean.valueOf(groupingObject.get('isDisabled'))) {
                    continue;
                }
                // Define the new DBM_Report_Grouping__c record based on values in the request and add it to both the list and the map
                DBM_Report_Grouping__c newGrouping = new DBM_Report_Grouping__c();
                newGrouping.Report__c = newReport.Id;
                // newGrouping.Id = (String)groupingObject.get('id');
                newGrouping.Name = (String)groupingObject.get('name');
                newGrouping.Data_Source__c = (String)groupingObject.get('dataSource');
                newGrouping.Object_Name__c = (String)groupingObject.get('objectName');
                newGrouping.Field_Name__c = (String)groupingObject.get('fieldName');
                newGrouping.Grouping_Number__c = (Integer)groupingObject.get('groupingNumber');
                newGrouping.Enumerate_Entries__c = (Boolean)groupingObject.get('enumerate');
                groupingEntryMap.put(newGrouping.Name, new List<DBM_Report_Grouping_Entry__C>());
                newGroupings.add(newGrouping);

                // Loop through each of the entries within the grouping
                integer groupingOrder = 0;  // Since grouping order is only implicitly defined in the LWC, we explicitly define it here
                for (Object groupingEntry : (List<Object>)groupingObject.get('entries')) {
                    Map<String, Object> groupingEntryObject = (Map<String, Object>) groupingEntry;
                    // Define the new DBM_Report_Grouping_Entry__C based on values in the request and add it to the map based on the parent grouping's name
                    DBM_Report_Grouping_Entry__C newGroupingEntry = new DBM_Report_Grouping_Entry__C();
                    // newGroupingEntry.Id = (String)groupingEntryObject.get('id');
                    newGroupingEntry.Name = (String)groupingEntryObject.get('value');
                    String recordId = String.valueOf(groupingEntryObject.get('recordId'));
                    newGroupingEntry.Record_ID__c = recordId;
                    if (!String.isBlank(recordId) && recordId.startsWith(userObjectPrefix)) {
                        newGroupingEntry.User__c = newGroupingEntry.Record_ID__c;
                    }
                    newGroupingEntry.Grouping_Order__c = groupingOrder;
                    groupingEntryMap.get(newGrouping.Name).add(newGroupingEntry);
                    groupingOrder++;
                }
            }
            insert newGroupings;
            // upsert newGroupings;

            // After the Grouping records have been inserted, we can go back through the Entry records and update the lookup field value
            List<DBM_Report_Grouping_Entry__C> newGroupingEntries = new List<DBM_Report_Grouping_Entry__C>();
            for (DBM_Report_Grouping__c grouping : newGroupings) {
                for (DBM_Report_Grouping_Entry__C groupingEntry : groupingEntryMap.get(grouping.Name)) {
                    groupingEntry.Grouping__c = grouping.Id;
                    groupingEntry.Report__c = newReport.Id;
                    System.debug('new groupingEntry = '+ groupingEntry);
                    newGroupingEntries.add(groupingEntry);
                }
            }
            insert newGroupingEntries;

            // Instantiate the list of DBM_Data_Entry__c records
            List<DBM_Data_Entry__c> newDataEntries = new List<DBM_Data_Entry__c>();
            // Break the `data` property of the request object into a list of objects (each object being a row of numbers)
            List<Object> dataRows = (List<Object>)requestObject.get('data');
            // Loop through the rows
            for (integer rowIndex=0; rowIndex<dataRows.size(); rowIndex++) {
                // Break each row into a list of objects (each object being an individual numeric data entry value)
                List<Object> cells = (List<Object>)dataRows[rowIndex];
                // Loop through each cell in the row
                for (integer colIndex=0; colIndex<cells.size(); colIndex++) {
                    // If the value of the Data Entry is blank, don't bother creating a record for it
                    if (String.isBlank(String.valueOf(cells[colIndex]))) {
                        continue;
                    }
                    // Define the new DBM_Data_Entry__c record
                    DBM_Data_Entry__c newDataEntry = new DBM_Data_Entry__c();
                    newDataEntry.Grouping_1__c = groupingEntryMap.get(newGroupings[0].Name)[rowIndex].Id;
                    if (newGroupings.size() == 2) {
                        newDataEntry.Grouping_2__c = groupingEntryMap.get(newGroupings[1].Name)[colIndex].Id;
                    }
                    System.debug('in row '+ rowIndex+ ', col '+ colIndex +', cell value = '+ cells[colIndex]);
                    newDataEntry.Value__c = Double.valueOf(cells[colIndex]);
                    newDataEntry.Report__c = newReport.Id;
                    newDataEntries.add(newDataEntry);
                }
            }
            insert newDataEntries;
            
            returnMap.put('reportId', newReport.Id);
            returnMap.put('isSuccess', true);
        } catch (Exception e) {
            returnMap.put('errorMessage', e.getMessage());
            returnMap.put('isSuccess', false);
        }
        return returnMap;
    }

    public static MetadataService.MetadataPort createService() {
        System.debug('in createService()');
        MetadataService.MetadataPort service = new MetadataService.MetadataPort();
        service.SessionHeader = new MetadataService.SessionHeader_element();
        service.SessionHeader.sessionId = UserInfo.getSessionId().substring(15);    // Per https://kevanmoothien.medium.com/how-to-output-salesforce-session-id-in-apex-debug-log-c12dfa94333a
        return service;
    }

    @AuraEnabled
    public static void createReport(Id reportDetailsRecordId) {
        System.debug('in createReport, reportDetailsRecordId = '+ reportDetailsRecordId);
        generateReport(reportDetailsRecordId);
    }

    @Future(callout=true)
    public static void generateReport(Id reportDetailsRecordId) {
        System.debug('in generateReport: '+ reportDetailsRecordId);
        try {
            MetadataService.MetadataPort service = createService();
            MetadataService.Report newReport = new MetadataService.Report();

            DBM_Report__c reportDetailsRecord = [SELECT Id, Name, Metric_Label__c, Metric_Type__c, Metric_type_enum__c, Number_of_Groupings__c, Report_ID__c, Report_Folder_Name__c FROM DBM_Report__c WHERE Id =: reportDetailsRecordId];
            String existingReportDeveloperName;
            // Report existingReport = [SELECT Id FROM Report WHERE Id =: reportDetailsRecord.Report_ID__c];
            if (!String.isBlank(reportDetailsRecord.Report_ID__c)) {
                List<Report> existingReports = [SELECT Id, DeveloperName FROM Report WHERE Id =: reportDetailsRecord.Report_ID__c];
                if (existingReports.size() > 0) {
                    existingReportDeveloperName = existingReports[0].DeveloperName;
                }
            }
            System.debug('reportDetailsRecord = '+ reportDetailsRecord);

            /* Do some metadata processing */
            MetadataService.ReportColumn[] columns = new List<MetadataService.ReportColumn>();
            MetadataService.ReportBucketField[] buckets = new List<MetadataService.ReportBucketField>();
            MetadataService.ReportGrouping[] groupings = new List<MetadataService.ReportGrouping>();
            MetadataService.ReportAggregate[] aggregates = new List<MetadataService.ReportAggregate>();
            MetadataService.ReportFilter filter = new MetadataService.ReportFilter();
            MetadataService.ReportChart chart = null;//getMetadataChart(fakeObjRes.getName() + '.' + columnFieldNames[0]);
            
            columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ valueFieldRes.getName(), true));
            columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ grouping1OrderFieldRes.getName(), true));
            if (reportDetailsRecord.Number_of_Groupings__c == 2) {
                columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ grouping2OrderFieldRes.getName(), true));
            }
            columns.add(getMetadataColumn('CHILD_NAME', false)); // DBM_Data_Entry__c object name
            System.debug('columns = '+ columns);

            List<DescribeFieldResult> groupingFieldResults = new DescribeFieldResult[] { grouping1FieldRes, grouping2FieldRes };
            integer groupingIndex = 0;
            for (DBM_Report_Grouping__c grouping : [SELECT Name FROM DBM_Report_Grouping__c WHERE Report__c =: reportDetailsRecordId]) {
                // String fieldName = 
                MetadataService.ReportBucketField bucket = getMetadataBucket(dataEntryObjRes.getName() + '.'+ groupingFieldResults[groupingIndex].getName(), grouping.Name, groupingIndex);
                buckets.add(bucket);
                String sortByName = dataEntryObjRes.getName() +'.'+ (groupingIndex == 0 ? grouping1OrderFieldRes.getName() : grouping2OrderFieldRes.getName());
                groupings.add(getMetadataGrouping(bucket.developerName, sortByName));
                groupingIndex++;
            }

            for (MetadataService.ReportBucketField bucket : buckets)
                System.debug('bucket = '+ bucket.masterLabel +', '+ bucket.sourceColumnName +', '+ bucket.developerName);            

            aggregates.add(getFormulaColumn(reportDetailsRecord.Metric_Label__c, reportDetailsRecord.Metric_type_enum__c));
            System.debug(aggregates[0]);
            System.debug(aggregates[0].masterLabel);

            filter = getMetadataFilter(reportDetailsRecord.Id);
            /* End metadata processing */

            newReport.type = 'Report';  // type of metadata
            newReport.reportType = 'CustomEntityCustomEntity$'+ reportObjRes.getName() +'$'+ dataEntryObjRes.getName(); // data source, i.e. sobject(s)
            newReport.name = reportDetailsRecord.Name.left(apiNameMaxLength);
            newReport.folderName = reportDetailsRecord.Report_Folder_Name__c;
            String developerName = String.isBlank(existingReportDeveloperName) ? 'DBM'+ Datetime.now().getTime() : existingReportDeveloperName;
            newReport.fullName = reportDetailsRecord.Report_Folder_Name__c +'/'+ developerName;
            newReport.columns = columns;
            newReport.buckets = buckets;
            newReport.aggregates = aggregates;
            newReport.groupingsDown = groupings;
            newReport.filter = filter;
            newReport.chart = chart; // TODO: add chart
            newReport.format = Reports.ReportFormat.SUMMARY.name();
            newReport.scope = 'organization';   // no idea what this does, but it seems to work
            newReport.showDetails = true;   // personal preference            
            System.debug('newReport = '+ newReport);
            System.debug('newReport.reportType = '+ newReport.reportType);
            // Create the report clone
            MetadataService.SaveResult result;
            // if (existingReport == null) {
            if (String.isBlank(reportDetailsRecord.Report_ID__c)) {
                result = service.createMetadata(new MetadataService.Metadata[] { newReport })[0];
            } else {
                result = service.updateMetadata(new MetadataService.Metadata[] { newReport })[0];
            }
            handleSaveResults(result);
            System.debug('final save result = '+ result);
            Report insertedReport = [SELECT Id FROM Report WHERE DeveloperName =: developerName];
            reportDetailsRecord.Report_ID__c = insertedReport.Id;
            update reportDetailsRecord;
            // Handle results
            // return result;
            if (result.success) {       
                DBM_Event__e successEvent = new DBM_Event__e(Report_ID__c = insertedReport.Id, Report_Details_Record_ID__c = reportDetailsRecordId, Message__c = 'Success: '+ result.fullName, Is_Success__c = true);
                Database.SaveResult messageResult = EventBus.publish(successEvent);
                if (messageResult.isSuccess()) {
                    System.debug('Successfully published event.');
                } else {
                    for(Database.Error err : messageResult.getErrors()) {
                        System.debug('Error returned: ' + err.getStatusCode() + ' - ' + err.getMessage());
                    }
                }           
            }
        } catch (Exception e) {
            DBM_Event__e failureEvent = new DBM_Event__e(Message__c = 'Failure: '+ e.getMessage(), Is_Success__c = false);
            Database.SaveResult messageResult = EventBus.publish(failureEvent);
            if (messageResult.isSuccess()) {
                System.debug('Successfully published failure event.');
            } else {
                for(Database.Error err : messageResult.getErrors()) {
                    System.debug('Error returned: ' + err.getStatusCode() + ' - ' + err.getMessage());
                }
            }           
        }
    }

    @AuraEnabled
    public static Map<String, Object> sendFeedback(String subject, String body) {
        Map<String, Object> response = new Map<String, Object>();
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        List<String> bodyElements = new List<String>{ body, '<br>LOG DATA:' };
        Map<String, String> bodyMap = new Map<String, String>();
        bodyMap.put('Username', UserInfo.getUserName());
        bodyMap.put('Email', UserInfo.getUserEmail());
        bodyMap.put('Org ID', UserInfo.getOrganizationId());
        bodyMap.put('Org Name', UserInfo.getOrganizationName());
        for (String bodyElement : bodyMap.keySet()) {
            bodyElements.add(bodyElement +': '+ bodyMap.get(bodyElement));
        }
        email.setToAddresses(new List<String>{notificationEmail});
        email.setSubject(subject);    
        email.setHtmlBody(String.join(bodyElements, '<br>'));
        try {
            List<Messaging.SendEmailResult> results = Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
            response.put('isSuccess', true);
        } catch(Exception e){
            response.put('isSuccess', false);
            response.put('errorMessage', e.getMessage());
        }
        
        return response;
    }

    /* The following section is customized adapters based on the MetadataService class  */
    public static MetadataService.ReportColumn getMetadataColumn(String fullFieldName, boolean isNumber) {
        MetadataService.ReportColumn newColumn = new MetadataService.ReportColumn();
        newColumn.showChanges = null;
        newColumn.reverseColors = null;
        newColumn.field = fullFieldName;
        newColumn.aggregateTypes = isNumber ? new String[] {'Sum'/*, 'Average'*/} : null;
        return newColumn;
    }
    

    public static MetadataService.ReportBucketField getMetadataBucket(String fullFieldName, String label, Integer jankyUniqueCharacter) {
        MetadataService.ReportBucketField newBucket = new MetadataService.ReportBucketField();
        newBucket.values = null;
        newBucket.useOther = false;
        newBucket.sourceColumnName = fullFieldName;
        newBucket.otherBucketLabel = null;
        newBucket.nullTreatment = 'n';
        newBucket.masterLabel = label;
        newBucket.developerName = 'BucketField_'+ String.valueOf(jankyUniqueCharacter) + Datetime.now().getTime();
        newBucket.bucketType = 'text';
       return newBucket;
    }

    public static MetadataService.ReportGrouping getMetadataGrouping(String fieldDeveloperName, String sortByName) {
        MetadataService.ReportGrouping newGrouping = new MetadataService.ReportGrouping();
        newGrouping.sortType = 'Aggregate';
        newGrouping.sortOrder = 'Asc';
        newGrouping.sortByName = sortByName;
        newGrouping.field = fieldDeveloperName;
        newGrouping.dateGranularity = 'Day';
        newGrouping.aggregateType = 'Sum';
        return newGrouping;
    }

    public static MetadataService.ReportFilter getMetadataFilter(Id reportDetailsRecordId) {
        MetadataService.ReportFilterItem newFilterItem = new MetadataService.ReportFilterItem();
        // newFilterItem.column = dataEntryObjRes.getName() + '.'+ reportFieldRes.getName();
        newFilterItem.column = 'CUST_ID';
        system.debug('newFilterItem.column = '+ newFilterItem.column);
        newFilterItem.isUnlocked = true;
        newFilterItem.operator = 'equals';
        newFilterItem.value = reportDetailsRecordId;
        MetadataService.ReportFilterItem[] newFilterItems = new List<MetadataService.ReportFilterItem>{newFilterItem};
        MetadataService.ReportFilter newFilter = new MetadataService.ReportFilter();
        newFilter.criteriaItems = newFilterItems;
        return newFilter;
    }

    public static MetadataService.ReportChart getMetadataChart(Id reportDetailsRecordId) {
        MetadataService.ReportChart newChart = new MetadataService.ReportChart();
        // newChart.chartType;
        // newChart.groupingColumn;
        // newChart.secondaryGroupingColumn;
        newChart.legendPosition = 'Right';
        newChart.location = 'CHART_TOP';
        newChart.showAxisLabels = true;
        newChart.size = 'Medium';
        newChart.summaryAxisRange = 'Auto';
        // newChart.title;
        return newChart;
    }


    public static MetadataService.ReportAggregate getFormulaColumn(String label, String datatype) {
        if(datatype == null) {
            datatype = METRIC_TYPE_NUMBER;
        }
        MetadataService.ReportAggregate agg = new MetadataService.ReportAggregate();
        // agg.calculatedFormula = dataEntryObjRes.getName() +'.'+ valueFieldRes.getName() +':SUM';
        agg.calculatedFormula = 'DBM_Data_Entry__c.Value__c:SUM';   // For some reason this fails with the namespace included, so I removed it
        if (datatype == METRIC_TYPE_PERCENT) {
            agg.calculatedFormula += '/100';
        }
        agg.datatype = datatype;
        agg.developerName = 'FORMULA1'; // note: must start with 'FORMULA'
        agg.isActive = true;
        agg.masterLabel = label;  
        return agg;  
    }

    public static void handleSaveResults(MetadataService.SaveResult saveResult)
    {
        // Nothing to see?
        if(saveResult==null || saveResult.success)
            return;
        // Construct error message and throw an exception
        if(saveResult.errors!=null)
        {
            List<String> messages = new List<String>();
            messages.add(
                (saveResult.errors.size()==1 ? 'Error ' : 'Errors ') +
                    'occured processing component ' + saveResult.fullName + '.');
            for(MetadataService.Error error : saveResult.errors) {
                System.debug('Error: '+ error.message);
                //messages.add('extended results: '+ error.ExtendedErrorDetails);
                messages.add(
                    error.message + ' (' + error.statusCode + ').' +
                    ( error.fields!=null && error.fields.size()>0 ?
                        ' Fields ' + String.join(error.fields, ',') + '.' : '' ) );
            }
            if(messages.size()>0)
                throw new DBM25Exception(String.join(messages, ' '));
        }
        if(!saveResult.success)
            throw new DBM25Exception('Request failed with no specified error.');
    }

    // Used for testing/debugging purposes
    public static void readReport(String fullName) {
        MetadataService.MetadataPort service = createService();
        System.debug('reading existing report');
        // 'dbm2__TestDBMFolder/dbm2__Fake1716792392347'
        MetadataService.Report reportToClone = (MetadataService.Report) service.readMetadata('Report', new String[] { fullName }).getRecords()[0];        
        System.debug('aggregates.size = '+ reportToClone.aggregates.size());
        System.debug('aggregates = '+ reportToClone.aggregates[0]);
        for (MetadataService.ReportColumn col : reportToClone.columns) {
            System.debug(col);
        }
        System.debug(reportToClone.chart);
        
    }
}