/**
 * Dataset Configuration
 * Manages multiple Domo datasets
 */
export const DATASETS = [
    {
        id: 'jira',
        name: 'JIRA Issues',
        datasetId: '120454dd-a8ff-4ab9-bf55-fae5c2e87852',
        filePath: 'jira-data.csv',
    },
    {
        id: 'zendesk',
        name: 'Zendesk Tickets',
        datasetId: '74eb3c98-8ed4-4591-af94-ef21e87b5a3c',
        filePath: 'zendesk-data.csv',
    },
];
export function getDatasetById(id) {
    return DATASETS.find(d => d.id === id);
}
export function getDatasetByDomoId(domoId) {
    return DATASETS.find(d => d.datasetId === domoId);
}
export function getAllDatasets() {
    return DATASETS;
}
//# sourceMappingURL=dataset-config.js.map