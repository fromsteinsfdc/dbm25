public without sharing class DBM25Controller {

    public class DBM25Exception extends Exception {}
    public static Integer apiNameMaxLength = 40;    
    public static DescribeSObjectResult reportObjRes = DBM_Report__c.getSObjectType().getDescribe();
    public static DescribeSObjectResult dataEntryObjRes = DBM_Data_Entry__c.getSObjectType().getDescribe();
    public static DescribeFieldResult reportFieldRes = DBM_Data_Entry__c.Report__c.getDescribe();
    public static DescribeFieldResult valueFieldRes = DBM_Data_Entry__c.Value__c.getDescribe();
    public static DescribeFieldResult grouping1FieldRes = DBM_Data_Entry__c.Grouping_1__c.getDescribe();
    public static DescribeFieldResult grouping2FieldRes = DBM_Data_Entry__c.Grouping_2__c.getDescribe();
    public static DescribeFieldResult grouping1OrderFieldRes = DBM_Data_Entry__c.Grouping_1_Order__c.getDescribe();
    public static DescribeFieldResult grouping2OrderFieldRes = DBM_Data_Entry__c.Grouping_2_Order__c.getDescribe();

    public static Map<String, SObjectType> globalDescribe {
        get { 
            if (globalDescribe == null) {
                return Schema.getGlobalDescribe();
            }
            return globalDescribe;
        }
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
            System.debug('Error: '+ e.getMessage());
            return null;
        }
    }

    @AuraEnabled
    public static String saveReportDetails(String reportDetailsString) {
        // Deserialize the `reportDetails` JSON object into a map of Apex objects
        Map<String, Object> requestObject = (Map<String, Object>)JSON.deserializeUntyped(reportDetailsString);
        
        // Define and insert the DBM_Report__c record with values from the request
        DBM_Report__c newReport = new DBM_Report__c();
        newReport.Name = (String)requestObject.get('reportName');
        newReport.Metric_Label__c = (String)requestObject.get('metricLabel');
        newReport.Metric_Type__c = (String)requestObject.get('metricType');
        newReport.Report_Folder_name__c = (String)requestObject.get('folderDeveloperName');
        insert newReport;

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
            newGrouping.Name = (String)groupingObject.get('name');
            newGrouping.Data_Source__c = (String)groupingObject.get('dataSource');
            newGrouping.Object_Name__c = (String)groupingObject.get('objectName');
            newGrouping.Field_Name__c = (String)groupingObject.get('fieldName');            
            groupingEntryMap.put(newGrouping.Name, new List<DBM_Report_Grouping_Entry__C>());
            newGroupings.add(newGrouping);

            // Loop through each of the entries within the grouping
            integer groupingOrder = 0;  // Since grouping order is only implicitly defined in the LWC, we explicitly define it here
            for (Object groupingEntry : (List<Object>)groupingObject.get('entries')) {
                Map<String, Object> groupingEntryObject = (Map<String, Object>) groupingEntry;
                // Define the new DBM_Report_Grouping_Entry__C based on values in the request and add it to the map based on the parent grouping's name
                DBM_Report_Grouping_Entry__C newGroupingEntry = new DBM_Report_Grouping_Entry__C();
                newGroupingEntry.Name = (String)groupingEntryObject.get('value');
                newGroupingEntry.Record_ID__c = (String)groupingEntryObject.get('recordId');
                newGroupingEntry.Grouping_Order__c = groupingOrder;
                groupingEntryMap.get(newGrouping.Name).add(newGroupingEntry);
                groupingOrder++;
            }

        }
        insert newGroupings;

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
        
        String responseString = newReport.Id;
        return responseString;
    }

    /* CREATE REPORT METADATA TEST CODE */
    public static MetadataService.MetadataPort createService() {
        System.debug('in createService()');
        MetadataService.MetadataPort service = new MetadataService.MetadataPort();
        service.SessionHeader = new MetadataService.SessionHeader_element();
        service.SessionHeader.sessionId = UserInfo.getSessionId().substring(15);    // Per https://kevanmoothien.medium.com/how-to-output-salesforce-session-id-in-apex-debug-log-c12dfa94333a
        return service;
    }

    // public static MetadataService.SaveResult createReport(String folderName, String reportName, String primaryGrouping, String secondaryGrouping, String metricName, String metricType) {
    @AuraEnabled
    public static void createReport(Id reportId) {
        System.debug('in createReport, reportId = '+ reportId);
        // generateReport(reportId);
        generateReport(reportId);
    }

    @Future(callout=true)
    public static void generateReport(Id reportId) {
        System.debug('in generateReport: '+ reportId);
        MetadataService.MetadataPort service = createService();
        // readReport(service);
        // generateReport(service, reportId);
    // }

    // // @Future(callout=true)
    // public static void generateReport(MetadataService.MetadataPort service, Id reportId) {
        try {
            // MetadataService.MetadataPort service = createService();
            MetadataService.Report newReport = new MetadataService.Report();

            DBM_Report__c report = [SELECT Name, Metric_Label__c, Metric_Type__c, Metric_type_enum__c, Report_Folder_Name__c FROM DBM_Report__c WHERE Id =: reportId];
            System.debug('report = '+ report);

            /* Do some metadata processing */
            MetadataService.ReportColumn[] columns = new List<MetadataService.ReportColumn>();
            MetadataService.ReportBucketField[] buckets = new List<MetadataService.ReportBucketField>();
            MetadataService.ReportGrouping[] groupings = new List<MetadataService.ReportGrouping>();
            MetadataService.ReportAggregate[] aggregates = new List<MetadataService.ReportAggregate>();
            MetadataService.ReportFilter filter = new MetadataService.ReportFilter();
            MetadataService.ReportChart chart = null;//getMetadataChart(fakeObjRes.getName() + '.' + columnFieldNames[0]);
            
            /*
            DescribeFieldResult[] describeFieldResults = new DescribeFieldResult[] { valueFieldRes, grouping1OrderFieldRes, grouping2OrderFieldRes };
            System.debug('columnFieldNames = '+ columnFieldNames);        
            for (DescribeFieldResult fieldRes : describeFieldResults) {
                String fullFieldName = dataEntryObjRes.getName() +'.'+ fieldRes.getName();
                String fieldType = fieldRes.getType().name().toLowerCase();
                boolean isNumber = fieldType == 'integer' || fieldType == 'percent' || fieldType == 'currency' || fieldType == 'double' || fieldType == 'long';            
                columns.add(getMetadataColumn(fullFieldName, isNumber));
            }
            */
            columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ valueFieldRes.getName(), true));
            columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ grouping1OrderFieldRes.getName(), true));
            columns.add(getMetadataColumn(dataEntryObjRes.getName() +'.'+ grouping2OrderFieldRes.getName(), true));
            columns.add(getMetadataColumn('CUST_NAME', false)); // seems to be the format for getting the object's name field
            System.debug('columns = '+ columns);

            List<DescribeFieldResult> groupingFieldResults = new DescribeFieldResult[] { grouping1FieldRes, grouping2FieldRes };
            integer groupingIndex = 0;
            for (DBM_Report_Grouping__c grouping : [SELECT Name FROM DBM_Report_Grouping__c WHERE Report__c =: reportId]) {
                MetadataService.ReportBucketField bucket = getMetadataBucket(dataEntryObjRes.getName() + '.'+ groupingFieldResults[groupingIndex].getName(), grouping.Name, groupingIndex);
                buckets.add(bucket);
                groupings.add(getMetadataGrouping(bucket.developerName));
                groupingIndex++;
            }

            /*
            if (primaryGrouping != null) {
                MetadataService.ReportBucketField bucket = getMetadataBucket(fakeObjRes.getName() + '.'+ fakeObjectFields.get('primaryGrouping'), primaryGrouping, 0);
                buckets.add(bucket);
                groupings.add(getMetadataGrouping(bucket.developerName));
                //chart.groupingColumn = bucket.developerName;
            }
            System.debug('secondaryGrouping = '+ secondaryGrouping);
            if (secondaryGrouping != null) {
                MetadataService.ReportBucketField bucket = getMetadataBucket(fakeObjRes.getName() +'.'+ fakeObjectFields.get('secondaryGrouping'), secondaryGrouping, 1);
                buckets.add(bucket);
                groupings.add(getMetadataGrouping(bucket.developerName));
                //chart.secondaryGroupingColumn = bucket.developerName;
            }
            */
            for (MetadataService.ReportBucketField bucket : buckets)
                System.debug('bucket = '+ bucket.masterLabel +', '+ bucket.sourceColumnName +', '+ bucket.developerName);            

            aggregates.add(getFormulaColumn(report.Metric_Label__c, report.Metric_type_enum__c));
            System.debug(aggregates[0]);
            System.debug(aggregates[0].masterLabel);

            filter = getMetadataFilter(report.Id);
            /* End metadata processing */

            newReport.type = 'Report';  // type of metadata
            // newReport.reportType = 'CustomEntity$' + dataEntryObjRes.getName(); // data source, i.e. sobject(s)
            newReport.reportType = 'CustomEntityCustomEntity$dbm2__DBM_Report__c$dbm2__DBM_Data_Entry__c'; // data source, i.e. sobject(s)
            newReport.name = report.Name.left(apiNameMaxLength);
            newReport.folderName = report.Report_Folder_Name__c;
            newReport.fullName = report.Report_Folder_Name__c +'/DBM'+ Datetime.now().getTime();
            newReport.columns = columns; // public MetadataService.ReportColumn[] columns;
            newReport.buckets = buckets; // public MetadataService.ReportBucketField[] buckets;
            newReport.chart = chart; // public MetadataService.ReportChart chart;
            newReport.groupingsDown = groupings; // MetadataService.ReportGrouping[]
            newReport.filter = filter; // MetadataService.ReportFilter
            newReport.format = Reports.ReportFormat.SUMMARY.name();
            newReport.scope = 'organization';   // no idea what this does, but it seems to work
            newReport.showDetails = true;   // personal preference
            newReport.aggregates = aggregates; //public MetadataService.ReportAggregate[] aggregates;
            System.debug('newReport = '+ newReport);
            System.debug('newReport.reportType = '+ newReport.reportType);
            // Create the report clone
            MetadataService.SaveResult
            result = service.createMetadata(new MetadataService.Metadata[] { newReport })[0];
            System.debug('final save result = '+ result);
            // Handle results
            handleSaveResults(result);
            // return result;
            if (result.success) {       
                DBM_Event__e successEvent = new DBM_Event__e(Report_Id__c = reportId, Message__c = 'Success: '+ result.fullName);
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
            DBM_Event__e failureEvent = new DBM_Event__e(Message__c = 'Failure: '+ e.getMessage());
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

    public static MetadataService.ReportGrouping getMetadataGrouping(String fieldDeveloperName) {
        MetadataService.ReportGrouping newGrouping = new MetadataService.ReportGrouping();
        newGrouping.sortType = null;
        newGrouping.sortOrder = 'Asc';
        newGrouping.sortByName = null;
        newGrouping.field = fieldDeveloperName;
        newGrouping.dateGranularity = 'Day';
        newGrouping.aggregateType = 'Sum';
        return newGrouping;
    }

    public static MetadataService.ReportFilter getMetadataFilter(Id reportId) {
        MetadataService.ReportFilterItem newFilterItem = new MetadataService.ReportFilterItem();
        // newFilterItem.column = dataEntryObjRes.getName() + '.'+ reportFieldRes.getName();
        newFilterItem.column = 'CUST_ID';
        system.debug('newFilterItem.column = '+ newFilterItem.column);
        newFilterItem.isUnlocked = true;
        newFilterItem.operator = 'equals';
        newFilterItem.value = reportId;
        MetadataService.ReportFilterItem[] newFilterItems = new List<MetadataService.ReportFilterItem>{newFilterItem};
        MetadataService.ReportFilter newFilter = new MetadataService.ReportFilter();
        newFilter.criteriaItems = newFilterItems;
        return newFilter;
    }

    public static MetadataService.ReportAggregate getFormulaColumn(String label, String datatype) {
        if(datatype == null) {
            datatype = 'number';
        }
        MetadataService.ReportAggregate agg = new MetadataService.ReportAggregate();
        // agg.calculatedFormula = dataEntryObjRes.getName() +'.'+ valueFieldRes.getName() +':SUM';
        agg.calculatedFormula = 'DBM_Data_Entry__c.Value__c:SUM';   // For some reason this fails with the namespace included, so I removed it
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
    public static void readReport(MetadataService.MetadataPort service) {
        System.debug('reading existing report');
        MetadataService.Report reportToClone = (MetadataService.Report) service.readMetadata('Report', new String[] { 'dbm2__TestDBMFolder/dbm2__Fake1716792392347' }).getRecords()[0];        
        System.debug('aggregates.size = '+ reportToClone.aggregates.size());
        System.debug('aggregates = '+ reportToClone.aggregates[0]);
    }
}