public with sharing class DBM25Controller {

    public class DBM25Exception extends Exception {}

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
            Schema.DescribeSObjectResult objDescribeSobject = Schema.getGlobalDescribe().get(objectName).getDescribe();            
            Schema.DescribeFieldResult fieldResult = objDescribeSobject.fields.getMap().get(fieldName).getDescribe();
            
            for (Schema.PicklistEntry pickListVal : fieldResult.getPicklistValues()) {
                picklistLabels.add(picklistVal.getLabel());
            }
        } catch (Exception e) {
            System.debug('Error: '+ e.getMessage());
        }
        return picklistLabels;
    }

    public DBM25Controller() {

    }
}