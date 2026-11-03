import { openDB, type IDBPDatabase } from "idb";
export function storageDeadline<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("STORAGE_TIMEOUT")), 3000);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
let connection: Promise<IDBPDatabase> | undefined;
export const database = () => {
  if (connection) return connection;
  const opening = openDB("sokudoku-game-v1", 1, {
    upgrade(db) {
      db.createObjectStore("answer", { keyPath: "id" });
      db.createObjectStore("cache");
    },
    blocking() {
      void opening.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  });
  connection = storageDeadline(opening).catch((error) => {
    connection = undefined;
    void opening.then(
      (db) => db.close(),
      () => {},
    );
    throw error;
  });
  return connection;
};
