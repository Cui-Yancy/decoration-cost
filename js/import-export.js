/* 装修管家 - 数据导入/导出 + 迁移适配器 */
const ImportExport = {
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  },

  migrateRecord(record, targetStore) {
    const migrated = { ...record };
    migrated._schemaVersion = 1;

    if (!migrated.id) {
      migrated.id = this.generateId();
    }

    if (targetStore === 'expenses') {
      if (!migrated.area) migrated.area = '未指定';
      if (!migrated.price) migrated.price = '0';
      if (!migrated.quantity) migrated.quantity = '1';
      if (migrated.amount && !migrated.price) {
        migrated.price = String(migrated.amount);
      }
      if (!migrated.purchaseDate && migrated.date) {
        migrated.purchaseDate = migrated.date;
      }
      if (!migrated.date && migrated.purchaseDate) {
        migrated.date = migrated.purchaseDate;
      }
      migrated.amount = (parseFloat(migrated.price) || 0) * (parseInt(migrated.quantity) || 1);
    } else if (targetStore === 'notes') {
      if (!migrated.phase) migrated.phase = '未分类';
      if (!migrated.location) migrated.location = '未指定';
      if (!migrated.priority) migrated.priority = '中';
      if (!migrated.status) migrated.status = '待处理';
    }

    return migrated;
  },

  exportToFile(data, pageName) {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = '装修' + pageName + '_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('导出数据失败:', e);
      return false;
    }
  },

  async importFromJSON(jsonData, dbManager, storeName) {
    try {
      const records = JSON.parse(jsonData);
      if (!Array.isArray(records)) return false;

      const existingRecords = await dbManager.getAllRecords();
      const existingIds = new Set(existingRecords.map(r => r.id));

      let importCount = 0;
      for (const record of records) {
        const migrated = this.migrateRecord(record, storeName);
        if (existingIds.has(migrated.id)) {
          migrated.id = this.generateId();
        }
        const saved = await dbManager.saveRecord(migrated);
        if (saved) {
          importCount++;
          existingIds.add(migrated.id);
        }
      }

      return importCount > 0;
    } catch (e) {
      console.error('导入数据失败:', e);
      return false;
    }
  },

  importAsReplace(jsonData, dbManager, storeName) {
    try {
      const records = JSON.parse(jsonData);
      if (!Array.isArray(records)) return false;

      return dbManager.clearAllRecords().then(async () => {
        for (const record of records) {
          const migrated = this.migrateRecord(record, storeName);
          if (!migrated.id) migrated.id = this.generateId();
          await dbManager.saveRecord(migrated);
        }
        return true;
      });
    } catch (e) {
      console.error('导入数据失败:', e);
      return false;
    }
  },

  setupFileImport(fileInputId, buttonId, dbManager, storeName, onComplete) {
    const fileInput = document.getElementById(fileInputId);
    const button = document.getElementById(buttonId);

    if (button && !button._importBound) {
      button._importBound = true;
      button.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput && !fileInput._importBound) {
      fileInput._importBound = true;
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();

          reader.onload = async (event) => {
            try {
              const result = await this.importFromJSON(event.target.result, dbManager, storeName);
              e.target.value = '';
              if (onComplete) onComplete(result);
            } catch (error) {
              console.error('导入处理失败:', error);
              if (onComplete) onComplete(false);
            }
          };

          reader.onerror = () => {
            NotificationUtils.show('文件读取失败！', 'error');
            if (onComplete) onComplete(false);
          };

          reader.readAsText(file);
        }
      });
    }
  }
};
