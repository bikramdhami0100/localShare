export declare function getPool(): import("pg").Pool;
export declare function checkDatabase(): Promise<Date>;
export declare function closePool(): Promise<void>;