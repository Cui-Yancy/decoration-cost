/* 装修管家 - 支出记录页面逻辑 */

// 模式检测：服务器模式用 API，本地模式用 IndexedDB
const IS_SERVER = window.APP_MODE === 'server';

const db = IS_SERVER
  ? createApiClient(window.API_BASE, 'expenses')
  : createIndexedDBManager('decoration_expenses_db', 'expenses', [
      { name: 'category', keyPath: 'category' },
      { name: 'area', keyPath: 'area' },
      { name: 'date', keyPath: 'date' }
    ]);

// 导入处理：服务器模式用 API 批量导入，本地模式写 IndexedDB
const ImportHandler = IS_SERVER ? db.importExport : {
  setupFileImport(fileInputId, buttonId, onComplete) {
    ImportExport.setupFileImport(fileInputId, buttonId, db, 'expenses', onComplete);
  }
};

// 数据管理
const DataManager = {
  async getAllRecords() {
    return await db.getAllRecords();
  },

  async saveRecords(records) {
    try {
      await db.clearAllRecords();
      for (const record of records) {
        await db.saveRecord(record);
      }
      return true;
    } catch (e) {
      console.error('批量保存记录失败:', e);
      return false;
    }
  },

  async addRecord(record) {
    try {
      if (!record || !record.category || !record.amount || !record.date) {
        console.error('添加支出记录失败: 缺少必要字段');
        return null;
      }

      record.id = ImportExport.generateId();
      record.createdAt = new Date().toISOString();

      if (typeof record.amount === 'string') {
        record.amount = parseFloat(record.amount);
      }
      if (!record.area) record.area = '未指定';

      const result = await db.saveRecord(record);
      return result;
    } catch (e) {
      console.error('添加支出记录异常:', e.stack || e);
      return null;
    }
  },

  async updateRecord(id, updatedRecord) {
    try {
      const existingRecord = await db.getRecord(id);
      if (existingRecord) {
        const recordToUpdate = { ...existingRecord, ...updatedRecord };
        await db.saveRecord(recordToUpdate);
        return true;
      }
      return false;
    } catch (e) {
      console.error('更新记录失败:', e);
      return false;
    }
  },

  async deleteRecord(id) {
    return await db.deleteRecord(id);
  },

  async getRecord(id) {
    return await db.getRecord(id);
  },

  async exportData() {
    const records = await this.getAllRecords();
    return ImportExport.exportToFile(records, '支出记录');
  }
};

// 支出记录控制器
const ExpenseController = {
  async addExpense(expenseData) {
    return await DataManager.addRecord(expenseData);
  },

  async updateExpense(id, expenseData) {
    return await DataManager.updateRecord(id, expenseData);
  },

  async deleteExpense(id) {
    return await DataManager.deleteRecord(id);
  },

  async getExpense(id) {
    return await DataManager.getRecord(id);
  },

  async getAllExpenses() {
    return await DataManager.getAllRecords();
  },

  async filterExpenses(filterCriteria) {
    let expenses = await this.getAllExpenses();

    if (filterCriteria.category && filterCriteria.category !== 'all') {
      expenses = expenses.filter(expense => expense.category === filterCriteria.category);
    }
    if (filterCriteria.area && filterCriteria.area !== 'all') {
      expenses = expenses.filter(expense => expense.area === filterCriteria.area);
    }
    if (filterCriteria.status && filterCriteria.status !== 'all') {
      expenses = expenses.filter(expense => expense.status === filterCriteria.status);
    }
    if (filterCriteria.searchTerm) {
      const searchTerm = filterCriteria.searchTerm.toLowerCase();
      expenses = expenses.filter(expense =>
        (expense.name || '').toLowerCase().includes(searchTerm) ||
        (expense.brand || '').toLowerCase().includes(searchTerm) ||
        (expense.model || '').toLowerCase().includes(searchTerm) ||
        (expense.notes || '').toLowerCase().includes(searchTerm)
      );
    }

    const sortBy = filterCriteria.sortBy || 'date_desc';
    expenses.sort((a, b) => {
      const amountA = (parseFloat(a.price) || 0) * (parseInt(a.quantity) || 1);
      const amountB = (parseFloat(b.price) || 0) * (parseInt(b.quantity) || 1);
      const dateA = new Date(a.purchaseDate || a.date || 0).getTime();
      const dateB = new Date(b.purchaseDate || b.date || 0).getTime();

      switch (sortBy) {
        case 'date_asc': return dateA - dateB;
        case 'amount_desc': return amountB - amountA;
        case 'amount_asc': return amountA - amountB;
        default: return dateB - dateA;
      }
    });
    return expenses;
  },

  calculateTotal(expenses) {
    return expenses.reduce((total, expense) => {
      const price = parseFloat(expense.price) || 0;
      const quantity = parseInt(expense.quantity) || 1;
      return total + (price * quantity);
    }, 0);
  },

  async getCategoryStats() {
    const expenses = await this.getAllExpenses();
    const stats = {};
    expenses.forEach(expense => {
      const category = expense.category || '其他';
      const price = parseFloat(expense.price) || 0;
      const quantity = parseInt(expense.quantity) || 1;
      stats[category] = (stats[category] || 0) + (price * quantity);
    });
    return stats;
  },

  async getAreaStats() {
    const expenses = await this.getAllExpenses();
    const stats = {};
    expenses.forEach(expense => {
      const area = expense.area || '其他';
      const price = parseFloat(expense.price) || 0;
      const quantity = parseInt(expense.quantity) || 1;
      stats[area] = (stats[area] || 0) + (price * quantity);
    });
    return stats;
  }
};

// UI控制器
const UIController = {
  chartInstance: null,
  currentChartType: 'category',
  currencyFormatter: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
  dateFormatter: new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }),

  async init() {
    this.setupEventListeners();
    ImageUpload.setupImageUpload('');
    ImageUpload.setupImageUpload('edit');
    await this.loadExpenseList();
    this.setTodayDate();
    await this.initChart();
  },

  setTodayDate() {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const el = document.getElementById('purchaseDate');
    if (el) el.value = formattedDate;
  },

  async setupEventListeners() {
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
      expenseForm.addEventListener('submit', this.handleExpenseFormSubmit.bind(this));
    }

    const editForm = document.getElementById('editForm');
    if (editForm) {
      editForm.addEventListener('submit', this.handleEditFormSubmit.bind(this));
    }

    const closeEditModalBtn = document.getElementById('closeEditModal');
    if (closeEditModalBtn) {
      closeEditModalBtn.addEventListener('click', () => this.closeEditModal());
    }
    const cancelEditBtn = document.getElementById('cancelEdit');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => this.closeEditModal());
    }

    const cancelDeleteBtn = document.getElementById('cancelDelete');
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener('click', () => this.closeConfirmDeleteModal());
    }
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => this.handleConfirmDelete());
    }

    const closeImagePreviewBtn = document.getElementById('closeImagePreview');
    if (closeImagePreviewBtn) {
      closeImagePreviewBtn.addEventListener('click', () => this.closeImagePreviewModal());
    }

    const clearAllBtn = document.getElementById('clearAllRecords');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.closeMoreActionsMenu();
        this.openConfirmClearModal();
      });
    }
    const moreActionsBtn = document.getElementById('moreActionsButton');
    if (moreActionsBtn) {
      moreActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMoreActionsMenu();
      });
    }
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('moreActionsMenu');
      const button = document.getElementById('moreActionsButton');
      if (!menu || !button || menu.classList.contains('hidden')) return;
      if (!menu.contains(e.target) && !button.contains(e.target)) {
        this.closeMoreActionsMenu();
      }
    });
    const cancelClearBtn = document.getElementById('cancelClearAll');
    if (cancelClearBtn) {
      cancelClearBtn.addEventListener('click', () => this.closeConfirmClearModal());
    }
    const confirmClearBtn = document.getElementById('confirmClearAll');
    if (confirmClearBtn) {
      confirmClearBtn.addEventListener('click', () => this.handleConfirmClearAll());
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) categoryFilter.addEventListener('change', () => this.handleFilterChange());
    const areaFilter = document.getElementById('areaFilter');
    if (areaFilter) areaFilter.addEventListener('change', () => this.handleFilterChange());
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', () => this.handleFilterChange());
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) sortFilter.addEventListener('change', () => this.handleFilterChange());

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearchInput(e));

    const refreshButton = document.getElementById('refreshData');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.handleRefresh());
    }

    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        DataManager.exportData() ? NotificationUtils.show('导出成功', 'success') : NotificationUtils.show('导出失败', 'error');
      });
    }

    ImportHandler.setupFileImport('fileInput', 'importData', (success) => {
      if (success) {
        this.loadExpenseList();
        this.updateChart();
        NotificationUtils.show('数据导入成功！已添加到现有记录中。', 'success');
      } else {
        NotificationUtils.show('数据导入失败，请检查文件格式！', 'error');
      }
    });

    // 图表类型切换
    const categoryChartBtn = document.getElementById('categoryChartBtn');
    const areaChartBtn = document.getElementById('areaChartBtn');
    if (categoryChartBtn && areaChartBtn) {
      categoryChartBtn.addEventListener('click', async () => {
        categoryChartBtn.classList.add('bg-primary', 'text-white');
        categoryChartBtn.classList.remove('bg-neutral-100', 'text-neutral-600');
        areaChartBtn.classList.add('bg-neutral-100', 'text-neutral-600');
        areaChartBtn.classList.remove('bg-primary', 'text-white');
        this.currentChartType = 'category';
        await this.updateChart();
      });
      areaChartBtn.addEventListener('click', async () => {
        areaChartBtn.classList.add('bg-primary', 'text-white');
        areaChartBtn.classList.remove('bg-neutral-100', 'text-neutral-600');
        categoryChartBtn.classList.add('bg-neutral-100', 'text-neutral-600');
        categoryChartBtn.classList.remove('bg-primary', 'text-white');
        this.currentChartType = 'area';
        await this.updateChart();
      });
    }
  },

  async handleExpenseFormSubmit(e) {
    e.preventDefault();

    const price = document.getElementById('price').value;
    const quantity = document.getElementById('quantity').value;
    const amount = price && quantity ? parseFloat(price) * parseFloat(quantity) : parseFloat(price) || 0;

    const expenseData = {
      category: document.getElementById('category').value,
      area: document.getElementById('area').value,
      name: document.getElementById('name').value,
      brand: document.getElementById('brand').value,
      model: document.getElementById('model').value,
      status: document.getElementById('status').value,
      channel: document.getElementById('channel').value,
      price: price,
      quantity: quantity,
      purchaseDate: document.getElementById('purchaseDate').value,
      imageUrl: document.getElementById('imageUrl').value,
      notes: document.getElementById('notes').value,
      amount: amount,
      date: document.getElementById('purchaseDate').value,
      createdAt: new Date().toISOString()
    };

    if (!expenseData.name || !expenseData.price || !expenseData.purchaseDate) {
      NotificationUtils.show('请填写项目名称、单价和购买日期', 'error');
      return;
    }

    try {
      const newExpense = await ExpenseController.addExpense(expenseData);
      if (newExpense) {
        document.getElementById('expenseForm').reset();
        this.setTodayDate();
        document.getElementById('imageUrl').value = '';
        const previewText = document.getElementById('imagePreviewText');
        const deleteBtn = document.getElementById('deleteImageButton');
        if (previewText) previewText.classList.add('hidden');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        await this.loadExpenseList();
        await this.updateChart();
        NotificationUtils.show('支出项目添加成功', 'success');
      } else {
        NotificationUtils.show('添加失败', 'error');
      }
    } catch (error) {
      console.error('添加支出记录时出错:', error.stack || error);
      NotificationUtils.show('添加过程中发生错误', 'error');
    }
  },

  async loadExpenseList(filterCriteria) {
    filterCriteria = filterCriteria || this.getCurrentFilterCriteria();
    try {
      const expenses = await ExpenseController.filterExpenses(filterCriteria);
      const expenseList = document.getElementById('expenseList');
      const expenseCards = document.getElementById('expenseCards');
      if (!expenseList && !expenseCards) return;

      if (expenseList) expenseList.innerHTML = '';
      if (expenseCards) expenseCards.innerHTML = '';

      const totalExpense = ExpenseController.calculateTotal(expenses);
      this.updateSummary(expenses, totalExpense);

      const filterStats = document.getElementById('filterStats');
      const filteredCount = document.getElementById('filteredCount');
      const totalExpenseEl = document.getElementById('totalExpense');
      if (filterStats && filteredCount && totalExpenseEl) {
        filterStats.classList.remove('hidden');
        filteredCount.textContent = expenses.length;
        totalExpenseEl.textContent = this.formatCurrency(totalExpense);
      }

      if (expenses.length === 0) {
        const emptyText = (filterCriteria.category !== 'all' || filterCriteria.area !== 'all' || filterCriteria.status !== 'all' || filterCriteria.searchTerm)
          ? '没有符合条件的记录'
          : '暂无记录，添加您的第一个装修项目吧';
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'text-center table-row-animate';
        emptyRow.innerHTML = '<td colspan="12" class="px-3 py-8 text-neutral-400"><i class="fa fa-folder-open-o text-2xl mb-2 block"></i>' + emptyText + '</td>';
        if (expenseList) expenseList.appendChild(emptyRow);
        if (expenseCards) {
          expenseCards.innerHTML = '<div class="text-center bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-neutral-400"><i class="fa fa-folder-open-o text-2xl mb-2 block"></i>' + emptyText + '</div>';
        }
        await this.updateChart();
        return true;
      }

      expenses.forEach(expense => {
        const row = document.createElement('tr');
        row.className = 'table-row-animate hover:bg-neutral-50';
        const totalPrice = (parseFloat(expense.price) || 0) * (parseInt(expense.quantity) || 1);
        const formattedDate = this.formatDate(expense.purchaseDate);

        row.innerHTML =
          '<td class="px-2 py-3 whitespace-nowrap">' + this.escapeHtml(expense.category || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + this.escapeHtml(expense.area || '-') + '</td>' +
          '<td class="px-2 py-3">' + this.escapeHtml(expense.name || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + this.escapeHtml(expense.brand || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + this.escapeHtml(expense.model || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + this.getStatusBadgeClass(expense.status) + '">' + this.escapeHtml(expense.status || '-') + '</span></td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + this.escapeHtml(expense.channel || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap money-nums">' + this.formatCurrency(parseFloat(expense.price) || 0) + ' / ' + this.escapeHtml(expense.quantity || '1') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap font-medium money-nums">' + this.formatCurrency(totalPrice) + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + (expense.imageUrl ? '<button type="button" aria-label="预览图片" class="text-primary hover:text-primary/80 preview-image-btn focus-ring rounded" data-image="' + this.escapeHtml(expense.imageUrl) + '"><i class="fa fa-image" aria-hidden="true"></i></button>' : '-') + '</td>' +
          '<td class="px-2 py-3 max-w-[120px] truncate" title="' + this.escapeHtml(expense.notes || '') + '">' + this.escapeHtml(expense.notes || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap"><div class="flex space-x-1">' +
            '<button type="button" aria-label="编辑记录" class="p-1 text-neutral-600 hover:text-primary edit-btn focus-ring rounded" data-id="' + this.escapeHtml(expense.id) + '"><i class="fa fa-pencil" aria-hidden="true"></i></button>' +
            '<button type="button" aria-label="删除记录" class="p-1 text-neutral-600 hover:text-danger delete-btn focus-ring rounded" data-id="' + this.escapeHtml(expense.id) + '"><i class="fa fa-trash" aria-hidden="true"></i></button>' +
          '</div></td>';

        if (expenseList) expenseList.appendChild(row);
        if (expenseCards) expenseCards.appendChild(this.createExpenseCard(expense, totalPrice, formattedDate));
      });

      // 绑定行内按钮
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const button = e.target.closest('.edit-btn');
          if (button && button.dataset.id) this.openEditModal(button.dataset.id);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const button = e.target.closest('.delete-btn');
          if (button && button.dataset.id) this.openConfirmDeleteModal(button.dataset.id);
        });
      });

      document.querySelectorAll('.preview-image-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const button = e.target.closest('.preview-image-btn');
          if (button && button.dataset.image) this.openImagePreviewModal(button.dataset.image);
        });
      });

      await this.updateChart();
      return true;
    } catch (error) {
      console.error('加载支出记录失败:', error);
      const expenseList = document.getElementById('expenseList');
      if (expenseList) {
        expenseList.innerHTML = '<tr class="text-center table-row-animate"><td colspan="12" class="px-3 py-8 text-danger"><i class="fa fa-exclamation-circle text-2xl mb-2 block"></i>加载记录失败，请刷新页面重试</td></tr>';
      }
      return false;
    }
  },

  createExpenseCard(expense, totalPrice, formattedDate) {
    const card = document.createElement('article');
    const productDetails = [expense.category || '-', expense.area || '-', expense.brand, expense.model]
      .filter(Boolean)
      .join(' · ');
    card.className = 'expense-card border border-neutral-200 rounded-lg p-4 bg-white';
    card.innerHTML =
      '<div class="flex items-start justify-between gap-3">' +
        '<div class="min-w-0">' +
          '<h3 class="font-semibold text-neutral-900 truncate">' + this.escapeHtml(expense.name || '-') + '</h3>' +
          '<p class="text-sm text-neutral-500 mt-1 truncate" title="' + this.escapeHtml(productDetails) + '">' + this.escapeHtml(productDetails) + '</p>' +
        '</div>' +
        '<p class="font-bold text-primary money-nums whitespace-nowrap">' + this.formatCurrency(totalPrice) + '</p>' +
      '</div>' +
      '<div class="mt-3 flex flex-wrap gap-2 text-xs">' +
        '<span class="inline-flex items-center px-2 py-1 rounded-full ' + this.getStatusBadgeClass(expense.status) + '">' + this.escapeHtml(expense.status || '-') + '</span>' +
        '<span class="inline-flex items-center px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">' + this.escapeHtml(expense.channel || '-') + '</span>' +
        '<span class="inline-flex items-center px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">' + this.escapeHtml(formattedDate || '-') + '</span>' +
      '</div>' +
      (expense.notes
        ? '<p class="mt-3 text-sm text-neutral-700 truncate" title="' + this.escapeHtml(expense.notes) + '"><span class="font-medium text-neutral-500">备注：</span>' + this.escapeHtml(expense.notes) + '</p>'
        : '') +
      '<div class="mt-2 flex justify-end">' +
        '<div class="flex items-center gap-2">' +
          (expense.imageUrl ? '<button type="button" aria-label="预览图片" class="p-2 text-primary hover:bg-primary/5 rounded-lg preview-image-btn focus-ring" data-image="' + this.escapeHtml(expense.imageUrl) + '"><i class="fa fa-image" aria-hidden="true"></i></button>' : '') +
          '<button type="button" aria-label="编辑记录" class="p-2 text-neutral-600 hover:text-primary hover:bg-primary/5 rounded-lg edit-btn focus-ring" data-id="' + this.escapeHtml(expense.id) + '"><i class="fa fa-pencil" aria-hidden="true"></i></button>' +
          '<button type="button" aria-label="删除记录" class="p-2 text-neutral-600 hover:text-danger hover:bg-red-50 rounded-lg delete-btn focus-ring" data-id="' + this.escapeHtml(expense.id) + '"><i class="fa fa-trash" aria-hidden="true"></i></button>' +
        '</div>' +
      '</div>';
    return card;
  },

  updateSummary(expenses, totalExpense) {
    const pendingCount = expenses.filter(expense => !['已验收', '已退货'].includes(expense.status)).length;
    const latestDate = expenses
      .map(expense => expense.purchaseDate || expense.date)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    this.setText('summaryTotalAmount', this.formatCurrency(totalExpense));
    this.setText('summaryRecordCount', String(expenses.length));
    this.setText('summaryPendingCount', String(pendingCount));
    this.setText('summaryLatestDate', latestDate ? this.formatDate(latestDate) : '-');
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  formatCurrency(value) {
    return this.currencyFormatter.format(Number(value) || 0);
  },

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return this.dateFormatter.format(date);
  },

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  getStatusBadgeClass(status) {
    switch (status) {
      case '已下单': return 'bg-blue-100 text-blue-800';
      case '已到货': return 'bg-amber-100 text-amber-800';
      case '已安装': return 'bg-green-100 text-green-800';
      case '已验收': return 'bg-teal-100 text-teal-800';
      case '已退货': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  },

  async openEditModal(id) {
    try {
      document.getElementById('editId').value = id;
      const expense = await ExpenseController.getExpense(id);

      if (expense) {
        const fieldsToFill = [
          { id: 'editCategory', value: expense.category },
          { id: 'editArea', value: expense.area },
          { id: 'editName', value: expense.name },
          { id: 'editBrand', value: expense.brand },
          { id: 'editModel', value: expense.model },
          { id: 'editStatus', value: expense.status },
          { id: 'editChannel', value: expense.channel },
          { id: 'editPrice', value: expense.price },
          { id: 'editQuantity', value: expense.quantity || '1' },
          { id: 'editPurchaseDate', value: expense.purchaseDate },
          { id: 'editImageUrl', value: expense.imageUrl },
          { id: 'editId', value: id }
        ];

        fieldsToFill.forEach(field => {
          const element = document.getElementById(field.id);
          if (element) element.value = field.value || '';
        });

        // 备注
        const editNotesEl = document.getElementById('editNotes');
        if (editNotesEl) editNotesEl.value = expense.notes || '';

        // 图片预览
        const editImagePreviewText = document.getElementById('editImagePreviewText');
        const deleteEditImageBtn = document.getElementById('deleteEditImageButton');
        if (editImagePreviewText) {
          if (expense.imageUrl) {
            editImagePreviewText.textContent = '已加载现有图片';
            editImagePreviewText.classList.remove('hidden');
          } else {
            editImagePreviewText.classList.add('hidden');
          }
        }
        if (deleteEditImageBtn) {
          deleteEditImageBtn.classList.toggle('hidden', !expense.imageUrl);
        }
      } else {
        const editForm = document.getElementById('editForm');
        if (editForm) editForm.reset();
        document.getElementById('editId').value = id;
      }

      ModalUtils.open('editModal', 'editModalContent');
    } catch (error) {
      console.error('打开编辑模态框失败:', error);
      NotificationUtils.show('打开编辑窗口失败', 'error');
    }
  },

  closeEditModal() {
    ModalUtils.close('editModal', 'editModalContent');
  },

  async handleEditFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const editNotesEl = document.getElementById('editNotes');
    const notesValue = editNotesEl ? editNotesEl.value : '';

    const updatedData = {
      category: document.getElementById('editCategory').value,
      area: document.getElementById('editArea').value,
      name: document.getElementById('editName').value,
      brand: document.getElementById('editBrand').value,
      model: document.getElementById('editModel').value,
      status: document.getElementById('editStatus').value,
      channel: document.getElementById('editChannel').value,
      price: document.getElementById('editPrice').value,
      quantity: document.getElementById('editQuantity').value,
      purchaseDate: document.getElementById('editPurchaseDate').value,
      imageUrl: document.getElementById('editImageUrl').value,
      notes: notesValue,
      updatedAt: new Date().toISOString()
    };

    if (!updatedData.name || !updatedData.price) {
      alert('请填写项目名称和单价');
      return;
    }

    try {
      const success = await ExpenseController.updateExpense(id, updatedData);
      if (success) {
        this.closeEditModal();
        await this.loadExpenseList();
        this.updateChart();
        NotificationUtils.show('更新成功', 'success');
      } else {
        NotificationUtils.show('更新失败', 'error');
      }
    } catch (error) {
      console.error('更新支出记录时出错:', error);
      NotificationUtils.show('更新过程中发生错误', 'error');
    }
  },

  openConfirmDeleteModal(id) {
    document.getElementById('confirmDelete').dataset.id = id;
    ModalUtils.open('confirmDeleteModal', 'confirmDeleteModalContent');
  },

  closeConfirmDeleteModal() {
    ModalUtils.close('confirmDeleteModal', 'confirmDeleteModalContent');
  },

  async handleConfirmDelete() {
    const id = document.getElementById('confirmDelete').dataset.id;
    try {
      const success = await ExpenseController.deleteExpense(id);
      if (success) {
        this.closeConfirmDeleteModal();
        await this.loadExpenseList();
        this.updateChart();
        NotificationUtils.show('删除成功', 'success');
      } else {
        NotificationUtils.show('删除失败', 'error');
      }
    } catch (error) {
      console.error('删除支出记录时出错:', error);
      NotificationUtils.show('删除过程中发生错误', 'error');
    }
  },

  openConfirmClearModal() {
    ModalUtils.open('confirmClearModal', 'confirmClearModalContent');
  },

  toggleMoreActionsMenu() {
    const menu = document.getElementById('moreActionsMenu');
    const button = document.getElementById('moreActionsButton');
    if (!menu || !button) return;

    const isHidden = menu.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(!isHidden));
  },

  closeMoreActionsMenu() {
    const menu = document.getElementById('moreActionsMenu');
    const button = document.getElementById('moreActionsButton');
    if (menu) menu.classList.add('hidden');
    if (button) button.setAttribute('aria-expanded', 'false');
  },

  closeConfirmClearModal() {
    ModalUtils.close('confirmClearModal', 'confirmClearModalContent');
  },

  async handleConfirmClearAll() {
    try {
      const success = await db.clearAllRecords();
      if (success) {
        this.closeConfirmClearModal();
        await this.loadExpenseList();
        this.updateChart();
        NotificationUtils.show('所有记录已清空', 'success');
      } else {
        NotificationUtils.show('清空记录失败', 'error');
      }
    } catch (error) {
      console.error('清空记录时出错:', error);
      NotificationUtils.show('清空过程中发生错误', 'error');
    }
  },

  openImagePreviewModal(imageUrl) {
    document.getElementById('previewImage').src = imageUrl;
    ModalUtils.open('imagePreviewModal');
  },

  closeImagePreviewModal() {
    ModalUtils.close('imagePreviewModal', null, () => {
      document.getElementById('previewImage').src = '';
    });
  },

  handleFilterChange() {
    this.loadExpenseList(this.getCurrentFilterCriteria());
  },

  handleSearchInput(e) {
    this.loadExpenseList({ ...this.getCurrentFilterCriteria(), searchTerm: e.target.value });
  },

  async handleRefresh() {
    const button = document.getElementById('refreshData');
    const icon = button ? button.querySelector('.fa-refresh') : null;
    if (!button || button.disabled) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', '正在刷新支出数据');
    if (icon) icon.classList.add('fa-spin');

    try {
      const refreshed = await this.loadExpenseList(this.getCurrentFilterCriteria());
      NotificationUtils.show(refreshed ? '数据已刷新' : '数据刷新失败，请稍后重试', refreshed ? 'success' : 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-label', '刷新支出数据');
      if (icon) icon.classList.remove('fa-spin');
    }
  },

  async initChart() {
    await this.updateChart();
  },

  async updateChart() {
    const ctx = document.getElementById('expenseChart');
    const totalAmountElement = document.getElementById('totalExpenseAmount');
    const chartLegendElement = document.getElementById('chartLegend');
    if (!ctx || !totalAmountElement || !chartLegendElement) return;

    try {
      const stats = this.currentChartType === 'category'
        ? await ExpenseController.getCategoryStats()
        : await ExpenseController.getAreaStats();

      const labels = Object.keys(stats);
      const data = Object.values(stats);
      const backgroundColor = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#8AC249', '#EA5F89', '#00C8B3', '#6C757D',
        '#FF6B6B', '#4ECDC4', '#FFD166', '#6A0572', '#AB83A1'
      ];

      const totalAmount = data.reduce((sum, amount) => sum + amount, 0);
      totalAmountElement.textContent = this.formatCurrency(totalAmount);

      if (this.chartInstance) this.chartInstance.destroy();

      this.chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColor.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = ((value / totalAmount) * 100).toFixed(1);
                  return label + ': ' + UIController.formatCurrency(value) + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });

      // 更新图例
      let legendHtml = '';
      for (let i = 0; i < labels.length; i++) {
        const percentage = ((data[i] / totalAmount) * 100).toFixed(1);
        legendHtml += '<div class="flex items-center mb-1"><div class="w-3 h-3 rounded-full mr-2" style="background-color: ' + backgroundColor[i] + '"></div><span class="text-sm flex-1 truncate">' + this.escapeHtml(labels[i]) + '</span><span class="text-sm text-right money-nums">' + this.formatCurrency(data[i]) + '</span></div>';
      }
      chartLegendElement.innerHTML = legendHtml;
    } catch (error) {
      console.error('更新图表失败:', error);
      totalAmountElement.textContent = '¥0.00';
      chartLegendElement.innerHTML = '<div class="text-center text-neutral-400 py-4">暂无数据显示</div>';
    }
  },

  getCurrentFilterCriteria() {
    const categoryFilter = document.getElementById('categoryFilter');
    const areaFilter = document.getElementById('areaFilter');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');
    const searchInput = document.getElementById('searchInput');

    return {
      category: categoryFilter ? categoryFilter.value : 'all',
      area: areaFilter ? areaFilter.value : 'all',
      status: statusFilter ? statusFilter.value : 'all',
      sortBy: sortFilter ? sortFilter.value : 'date_desc',
      searchTerm: searchInput ? searchInput.value : ''
    };
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  const purchaseDateEl = document.getElementById('purchaseDate');
  if (purchaseDateEl) purchaseDateEl.value = formattedDate;

  window.UIController = UIController;
  await UIController.init();
});
