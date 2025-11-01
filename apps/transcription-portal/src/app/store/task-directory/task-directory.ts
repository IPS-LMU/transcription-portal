export interface TaskDirectory {
  id: number;
  path: string;
  size?: number;
  folderName: string;
  entries: (Task | TaskDirectory)[];
}
