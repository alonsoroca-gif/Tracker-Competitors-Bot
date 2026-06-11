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
export declare const DATASETS: DatasetConfig[];
export declare function getDatasetById(id: string): DatasetConfig | undefined;
export declare function getDatasetByDomoId(domoId: string): DatasetConfig | undefined;
export declare function getAllDatasets(): DatasetConfig[];
//# sourceMappingURL=dataset-config.d.ts.map