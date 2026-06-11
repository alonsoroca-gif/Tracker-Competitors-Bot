/**
 * Dataset Configuration
 * Manages multiple Domo datasets
 */

export interface DatasetConfig {
  id: string;
  name: string;
  datasetId: string;
  filePath: string;
}

export const DATASETS: DatasetConfig[] = [
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

export function getDatasetById(id: string): DatasetConfig | undefined {
  return DATASETS.find(d => d.id === id);
}

export function getDatasetByDomoId(domoId: string): DatasetConfig | undefined {
  return DATASETS.find(d => d.datasetId === domoId);
}

export function getAllDatasets(): DatasetConfig[] {
  return DATASETS;
}
