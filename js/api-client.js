/* 装修管家 - HTTP API 客户端（服务器模式） */
function createApiClient(baseURL, storeName) {
  // 在服务器模式下，导入导出使用服务器端 API
  const ImportExport_for_server = {
    exportToFile(data, pageName) {
      return ImportExport.exportToFile(data, pageName);
    },

    generateId() {
      return ImportExport.generateId();
    },

    migrateRecord(record) {
      return ImportExport.migrateRecord(record, 'expenses');
    },

    async importFromJSON(jsonData) {
      try {
        const records = JSON.parse(jsonData);
        if (!Array.isArray(records)) return false;

        const resp = await fetch(baseURL + '/api/migrate/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(records)
        });
        const result = await resp.json();
        return result.imported > 0;
      } catch (e) {
        console.error('导入数据失败:', e);
        return false;
      }
    },

    setupFileImport(fileInputId, buttonId, onComplete) {
      const fileInput = document.getElementById(fileInputId);
      const button = document.getElementById(buttonId);

      if (button && !button._importBound) {
        button._importBound = true;
        button.addEventListener('click', () => { if (fileInput) fileInput.click(); });
      }

      if (fileInput && !fileInput._importBound) {
        fileInput._importBound = true;
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = async (event) => {
              try {
                const result = await this.importFromJSON(event.target.result);
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

  return {
    storeName,
    importExport: ImportExport_for_server,

    async getAllRecords() {
      try {
        const resp = await fetch(baseURL + '/api/' + this.storeName);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return await resp.json();
      } catch (e) {
        console.error('获取记录失败:', e);
        return [];
      }
    },

    async saveRecord(record) {
      try {
        // 检测是新增还是更新
        const existingResp = await fetch(baseURL + '/api/' + this.storeName + '/' + encodeURIComponent(record.id));
        const method = existingResp.ok ? 'PUT' : 'POST';
        const url = method === 'PUT'
          ? baseURL + '/api/' + this.storeName + '/' + encodeURIComponent(record.id)
          : baseURL + '/api/' + this.storeName;

        const resp = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return await resp.json();
      } catch (e) {
        console.error('保存记录失败:', e);
        return null;
      }
    },

    async deleteRecord(id) {
      try {
        const resp = await fetch(baseURL + '/api/' + this.storeName + '/' + encodeURIComponent(id), { method: 'DELETE' });
        return resp.ok;
      } catch (e) {
        console.error('删除记录失败:', e);
        return false;
      }
    },

    async getRecord(id) {
      try {
        const resp = await fetch(baseURL + '/api/' + this.storeName + '/' + encodeURIComponent(id));
        if (!resp.ok) return null;
        return await resp.json();
      } catch (e) {
        console.error('获取记录失败:', e);
        return null;
      }
    },

    async clearAllRecords() {
      try {
        const resp = await fetch(baseURL + '/api/' + this.storeName, { method: 'DELETE' });
        return resp.ok;
      } catch (e) {
        console.error('清空记录失败:', e);
        return false;
      }
    }
  };
}
