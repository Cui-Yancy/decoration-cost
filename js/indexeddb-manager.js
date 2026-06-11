/* 装修管家 - IndexedDB 通用管理器工厂 */
function createIndexedDBManager(dbName, storeName, indexes) {
  const manager = {
    DB_NAME: dbName,
    DB_VERSION: 1,
    STORE_NAME: storeName,
    db: null,

    initDB() {
      return new Promise((resolve, reject) => {
        if (this.db && this.db.readyState !== 'closed') {
          resolve(this.db);
          return;
        }

        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onerror = event => {
          console.error('打开数据库失败:', event.target.error);
          reject(event.target.error);
        };

        request.onsuccess = event => {
          this.db = event.target.result;
          this.db.onclose = () => { this.db = null; };
          resolve(this.db);
        };

        request.onupgradeneeded = event => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const objectStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            indexes.forEach(idx => {
              objectStore.createIndex(idx.name, idx.keyPath, { unique: false });
            });
          }
        };
      });
    },

    async getAllRecords() {
      try {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readonly');
          const objectStore = transaction.objectStore(this.STORE_NAME);
          const request = objectStore.getAll();

          request.onerror = event => {
            console.error('获取记录失败:', event.target.error);
            reject(event.target.error);
          };

          request.onsuccess = event => {
            const records = event.target.result || [];
            records.sort((a, b) => {
              if (a.id && b.id) {
                const timestampA = parseInt(a.id.substring(0, 13));
                const timestampB = parseInt(b.id.substring(0, 13));
                if (timestampA !== timestampB) return timestampB - timestampA;
                return b.id.localeCompare(a.id);
              }
              return new Date(b.date) - new Date(a.date);
            });
            resolve(records);
          };
        });
      } catch (e) {
        console.error('获取记录出错:', e);
        throw e;
      }
    },

    async saveRecord(record) {
      try {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const objectStore = transaction.objectStore(this.STORE_NAME);
          const request = objectStore.put(record);

          request.onerror = event => {
            console.error('保存记录失败:', event.target.error);
            reject(event.target.error);
          };

          request.onsuccess = () => resolve(record);
        });
      } catch (e) {
        console.error('保存记录出错:', e);
        return null;
      }
    },

    async deleteRecord(id) {
      try {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const objectStore = transaction.objectStore(this.STORE_NAME);
          const request = objectStore.delete(id);

          request.onerror = event => {
            console.error('删除记录失败:', event.target.error);
            reject(event.target.error);
          };

          request.onsuccess = () => resolve(true);
        });
      } catch (e) {
        console.error('删除记录出错:', e);
        return false;
      }
    },

    async getRecord(id) {
      try {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readonly');
          const objectStore = transaction.objectStore(this.STORE_NAME);
          const request = objectStore.get(id);

          request.onerror = event => {
            console.error('获取单个记录失败:', event.target.error);
            reject(event.target.error);
          };

          request.onsuccess = event => resolve(event.target.result || null);
        });
      } catch (e) {
        console.error('获取单个记录出错:', e);
        return null;
      }
    },

    async clearAllRecords() {
      try {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const objectStore = transaction.objectStore(this.STORE_NAME);
          const request = objectStore.clear();

          request.onerror = event => {
            console.error('清空记录失败:', event.target.error);
            reject(event.target.error);
          };

          request.onsuccess = () => resolve(true);
        });
      } catch (e) {
        console.error('清空记录出错:', e);
        return false;
      }
    }
  };

  return manager;
}
