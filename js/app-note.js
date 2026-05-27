/* 装修管家 - 注意事项页面逻辑 */

// 模式检测：服务器模式用 API，本地模式用 IndexedDB
const IS_SERVER = window.APP_MODE === 'server';

const db = IS_SERVER
  ? createApiClient(window.API_BASE, 'notes')
  : createIndexedDBManager('decoration_notes_db', 'notes', [
      { name: 'phase', keyPath: 'phase' },
      { name: 'location', keyPath: 'location' },
      { name: 'priority', keyPath: 'priority' },
      { name: 'status', keyPath: 'status' },
      { name: 'date', keyPath: 'date' }
    ]);

// 导入处理：服务器模式用 API 批量导入，本地模式写 IndexedDB
const ImportHandler = IS_SERVER ? db.importExport : {
  setupFileImport(fileInputId, buttonId, onComplete) {
    ImportExport.setupFileImport(fileInputId, buttonId, db, 'notes', onComplete);
  }
};

// 数据管理
const NoteDataManager = {
  async getAllRecords() {
    return await db.getAllRecords();
  },

  async exportData() {
    const records = await this.getAllRecords();
    return ImportExport.exportToFile(records, '注意事项');
  },

  async saveRecords(records) {
    try {
      await db.clearAllRecords();
      for (const record of records) {
        await db.saveRecord(record);
      }
      return true;
    } catch (e) {
      console.error('保存记录失败:', e);
      return false;
    }
  },

  async addRecord(record) {
    try {
      if (!record || !record.title || !record.date) {
        console.error('添加记录失败: 缺少必要字段（标题或日期）');
        return null;
      }

      record.id = ImportExport.generateId();
      record.createdAt = new Date().toISOString();

      if (!record.phase) record.phase = '未分类';
      if (!record.location) record.location = '未指定';
      if (!record.priority) record.priority = '中';
      if (!record.status) record.status = '待处理';

      return await db.saveRecord(record);
    } catch (e) {
      console.error('添加记录异常:', e.stack || e);
      return null;
    }
  },

  async updateRecord(id, updatedRecord) {
    try {
      const originalRecord = await db.getRecord(id);
      if (originalRecord) {
        updatedRecord.updatedAt = new Date().toISOString();
        const recordToSave = { ...originalRecord, ...updatedRecord };
        return await db.saveRecord(recordToSave);
      }
      return false;
    } catch (e) {
      console.error('更新记录失败:', e);
      return false;
    }
  },

  async deleteRecord(id) {
    try {
      return await db.deleteRecord(id);
    } catch (e) {
      console.error('删除记录失败:', e);
      return false;
    }
  },

  async getRecord(id) {
    try {
      return await db.getRecord(id);
    } catch (e) {
      console.error('获取单个记录失败:', e);
      return null;
    }
  }
};

// 注意事项控制器
const NoteController = {
  async addNote(noteData) { return await NoteDataManager.addRecord(noteData); },
  async updateNote(id, noteData) { return await NoteDataManager.updateRecord(id, noteData); },
  async deleteNote(id) { return await NoteDataManager.deleteRecord(id); },
  async getNote(id) { return await NoteDataManager.getRecord(id); },
  async getAllNotes() { return await NoteDataManager.getAllRecords(); },

  async filterNotes(filterCriteria) {
    try {
      let notes = await this.getAllNotes();

      if (filterCriteria.status && filterCriteria.status !== 'all') {
        notes = notes.filter(note => note.status === filterCriteria.status);
      }
      if (filterCriteria.phase && filterCriteria.phase !== 'all') {
        notes = notes.filter(note => note.phase === filterCriteria.phase);
      }
      if (filterCriteria.priority && filterCriteria.priority !== 'all') {
        notes = notes.filter(note => note.priority === filterCriteria.priority);
      }
      if (filterCriteria.searchTerm) {
        const searchTerm = filterCriteria.searchTerm.toLowerCase();
        notes = notes.filter(note =>
          note.title.toLowerCase().includes(searchTerm) ||
          note.description.toLowerCase().includes(searchTerm)
        );
      }
      return notes;
    } catch (e) {
      console.error('过滤注意事项失败:', e);
      return [];
    }
  },

  calculatePendingCount(notes) {
    return (notes || []).filter(note => note && note.status === '待处理').length;
  }
};

// UI控制器
const NoteUIController = {
  async init() {
    this.setupEventListeners();
    ImageUpload.setupImageUpload('');
    ImageUpload.setupImageUpload('edit');
    await this.loadNoteList();
    this.setTodayDate();
  },

  setTodayDate() {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const el = document.getElementById('noteDate');
    if (el) el.value = formattedDate;
  },

  setupEventListeners() {
    const noteForm = document.getElementById('noteForm');
    if (noteForm) noteForm.addEventListener('submit', this.handleNoteFormSubmit.bind(this));

    const editNoteForm = document.getElementById('editNoteForm');
    if (editNoteForm) editNoteForm.addEventListener('submit', this.handleEditNoteFormSubmit.bind(this));

    const closeEditBtn = document.getElementById('closeEditNoteModal');
    if (closeEditBtn) closeEditBtn.addEventListener('click', () => this.closeEditNoteModal());
    const cancelEditBtn = document.getElementById('cancelEditNote');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.closeEditNoteModal());

    const clearAllBtn = document.getElementById('clearAllNotesButton');
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.openConfirmClearModal());
    const cancelClearBtn = document.getElementById('cancelClearNotes');
    if (cancelClearBtn) cancelClearBtn.addEventListener('click', () => this.closeConfirmClearModal());
    const confirmClearBtn = document.getElementById('confirmClearNotes');
    if (confirmClearBtn) confirmClearBtn.addEventListener('click', () => this.handleConfirmClearAll());

    const cancelDeleteBtn = document.getElementById('cancelDeleteNote');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => this.closeConfirmDeleteNoteModal());
    const confirmDeleteBtn = document.getElementById('confirmDeleteNote');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => this.handleConfirmDeleteNote());

    const closeImagePreviewBtn = document.getElementById('closeImagePreview');
    if (closeImagePreviewBtn) closeImagePreviewBtn.addEventListener('click', () => this.closeImagePreviewModal());

    // 筛选器
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', () => this.handleFilterChange());
    const phaseFilter = document.getElementById('phaseFilter');
    if (phaseFilter) phaseFilter.addEventListener('change', () => this.handleFilterChange());
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) priorityFilter.addEventListener('change', () => this.handleFilterChange());
    const noteSearchInput = document.getElementById('noteSearchInput');
    if (noteSearchInput) noteSearchInput.addEventListener('input', (e) => this.handleSearchInput(e));

    // 导入导出
    const exportBtn = document.getElementById('exportNotesButton');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const result = await NoteDataManager.exportData();
        result ? NotificationUtils.show('导出成功', 'success') : NotificationUtils.show('导出失败', 'error');
      });
    }

    ImportHandler.setupFileImport('notesFileInput', 'importNotesButton', (success) => {
      if (success) {
        this.loadNoteList();
        NotificationUtils.show('数据导入成功！', 'success');
      } else {
        NotificationUtils.show('数据导入失败，请检查文件格式！', 'error');
      }
    });
  },

  async handleNoteFormSubmit(e) {
    e.preventDefault();

    const noteData = {
      title: document.getElementById('noteTitle').value,
      phase: document.getElementById('notePhase').value,
      location: document.getElementById('noteLocation').value,
      priority: document.getElementById('notePriority').value,
      status: document.getElementById('noteStatus').value,
      description: document.getElementById('noteDescription').value,
      date: document.getElementById('noteDate').value,
      imageUrl: document.getElementById('imageUrl').value,
      createdAt: new Date().toISOString()
    };

    if (!noteData.title || !noteData.date) {
      NotificationUtils.show('请填写注意事项主题和日期', 'error');
      return;
    }

    try {
      const newNote = await NoteController.addNote(noteData);
      if (newNote) {
        const noteForm = document.getElementById('noteForm');
        if (noteForm) { noteForm.reset(); this.setTodayDate(); }
        const imageUrlInput = document.getElementById('imageUrl');
        if (imageUrlInput) imageUrlInput.value = '';
        const imagePreviewText = document.getElementById('imagePreviewText');
        if (imagePreviewText) imagePreviewText.classList.add('hidden');

        await this.loadNoteList();
        NotificationUtils.show('添加成功', 'success');
      } else {
        NotificationUtils.show('添加失败', 'error');
      }
    } catch (error) {
      console.error('添加注意事项失败:', error.stack || error);
      NotificationUtils.show('添加过程中发生错误', 'error');
    }
  },

  async loadNoteList(filterCriteria) {
    filterCriteria = filterCriteria || this.getCurrentFilterCriteria();
    try {
      const noteList = document.getElementById('noteList');
      if (!noteList) return;

      noteList.innerHTML = '<tr class="text-center"><td colspan="8" class="px-3 py-8 text-neutral-500"><i class="fa fa-spinner fa-spin text-lg mr-2"></i>正在加载记录...</td></tr>';

      const notes = await NoteController.filterNotes(filterCriteria);
      noteList.innerHTML = '';

      const pendingCount = NoteController.calculatePendingCount(notes);

      const noteFilterStats = document.getElementById('noteFilterStats');
      const noteFilteredCount = document.getElementById('noteFilteredCount');
      const pendingCountEl = document.getElementById('pendingCount');
      if (noteFilterStats && noteFilteredCount && pendingCountEl) {
        noteFilterStats.classList.remove('hidden');
        noteFilteredCount.textContent = notes.length;
        pendingCountEl.textContent = pendingCount;
      }

      if (notes.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'text-center table-row-animate';
        emptyRow.innerHTML = '<td colspan="8" class="px-3 py-8 text-neutral-400"><i class="fa fa-folder-open-o text-2xl mb-2 block"></i>' +
          (filterCriteria.status || filterCriteria.priority || filterCriteria.searchTerm ? '没有符合条件的记录' : '暂无记录，添加您的第一条装修注意事项吧') + '</td>';
        noteList.appendChild(emptyRow);
        return;
      }

      notes.forEach(note => {
        const row = document.createElement('tr');
        row.className = 'table-row-animate hover:bg-neutral-50';
        const formattedDate = note.date ? new Date(note.date).toLocaleDateString('zh-CN') : '';

        row.innerHTML =
          '<td class="px-2 py-3 font-medium">' + note.title + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + note.phase + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + note.location + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + this.getPriorityBadgeClass(note.priority) + '">' + note.priority + '</span></td>' +
          '<td class="px-2 py-3 whitespace-nowrap"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + this.getStatusBadgeClass(note.status) + '">' + note.status + '</span></td>' +
          '<td class="px-2 py-3 whitespace-nowrap">' + formattedDate + '</td>' +
          '<td class="px-2 py-3 max-w-[150px] truncate" title="' + (note.description || '') + '">' + (note.description || '-') + '</td>' +
          '<td class="px-2 py-3 whitespace-nowrap"><div class="flex space-x-1">' +
            (note.imageUrl ? '<button class="p-1 text-neutral-600 hover:text-blue-500 preview-image-btn" title="查看图片" data-image="' + note.imageUrl + '"><i class="fa fa-image"></i><span class="ml-1">图片</span></button>' : '<span class="text-gray-400 text-sm">无图片</span>') +
            '<button class="p-1 text-neutral-600 hover:text-primary edit-note-btn" data-id="' + note.id + '"><i class="fa fa-pencil"></i></button>' +
            '<button class="p-1 text-neutral-600 hover:text-danger delete-note-btn" data-id="' + note.id + '"><i class="fa fa-trash"></i></button>' +
          '</div></td>';

        noteList.appendChild(row);
      });

      // 绑定行内按钮
      document.querySelectorAll('.edit-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          this.openEditNoteModal(btn.dataset.id);
        });
      });
      document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', () => this.openConfirmDeleteNoteModal(btn.dataset.id));
      });
      document.querySelectorAll('.preview-image-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const button = e.target.closest('.preview-image-btn');
          if (button && button.dataset.image) this.openImagePreviewModal(button.dataset.image);
        });
      });
    } catch (error) {
      console.error('加载注意事项列表失败:', error);
      const noteList = document.getElementById('noteList');
      if (noteList) {
        noteList.innerHTML = '<tr class="text-center"><td colspan="8" class="px-3 py-8 text-red-500"><i class="fa fa-exclamation-triangle mr-2"></i>加载记录失败，请刷新页面重试</td></tr>';
      }
    }
  },

  getPriorityBadgeClass(priority) {
    switch (priority) {
      case '低': return 'bg-blue-100 text-blue-800';
      case '中': return 'bg-yellow-100 text-yellow-800';
      case '高': return 'bg-orange-100 text-orange-800';
      case '紧急': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  },

  getStatusBadgeClass(status) {
    switch (status) {
      case '待处理': return 'bg-yellow-100 text-yellow-800';
      case '处理中': return 'bg-blue-100 text-blue-800';
      case '已完成': return 'bg-green-100 text-green-800';
      case '已取消': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  },

  async openEditNoteModal(id) {
    try {
      const note = await NoteController.getNote(id);
      if (!note) {
        NotificationUtils.show('未找到该记录', 'error');
        return;
      }

      document.getElementById('editNoteId').value = note.id;
      document.getElementById('editNoteTitle').value = note.title || '';
      document.getElementById('editNotePhase').value = note.phase || '';
      document.getElementById('editNoteLocation').value = note.location || '';
      document.getElementById('editNotePriority').value = note.priority || '';
      document.getElementById('editNoteStatus').value = note.status || '';
      document.getElementById('editNoteDescription').value = note.description || '';
      document.getElementById('editNoteDate').value = note.date || '';
      document.getElementById('editImageUrl').value = note.imageUrl || '';

      const editImagePreviewText = document.getElementById('editImagePreviewText');
      const deleteEditImageBtn = document.getElementById('deleteEditImageButton');
      if (editImagePreviewText) {
        if (note.imageUrl) {
          editImagePreviewText.textContent = '已加载现有图片';
          editImagePreviewText.classList.remove('hidden');
        } else {
          editImagePreviewText.classList.add('hidden');
        }
      }
      if (deleteEditImageBtn) {
        deleteEditImageBtn.classList.toggle('hidden', !note.imageUrl);
      }

      ModalUtils.open('editNoteModal', 'editNoteModalContent');
    } catch (error) {
      console.error('打开编辑模态框失败:', error);
      NotificationUtils.show('打开编辑窗口失败', 'error');
    }
  },

  closeEditNoteModal() {
    ModalUtils.close('editNoteModal', 'editNoteModalContent');
  },

  async handleEditNoteFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editNoteId').value;

    const updatedData = {
      title: document.getElementById('editNoteTitle').value,
      phase: document.getElementById('editNotePhase').value,
      location: document.getElementById('editNoteLocation').value,
      priority: document.getElementById('editNotePriority').value,
      status: document.getElementById('editNoteStatus').value,
      description: document.getElementById('editNoteDescription').value,
      date: document.getElementById('editNoteDate').value,
      imageUrl: document.getElementById('editImageUrl').value,
      updatedAt: new Date().toISOString()
    };

    if (!updatedData.title) { alert('请填写注意事项主题'); return; }

    const result = await NoteController.updateNote(id, updatedData);
    if (result) {
      this.closeEditNoteModal();
      await this.loadNoteList();
      NotificationUtils.show('更新成功', 'success');
    } else {
      NotificationUtils.show('更新失败', 'error');
    }
  },

  openConfirmClearModal() { ModalUtils.open('confirmClearNotesModal', 'confirmClearNotesModalContent'); },
  closeConfirmClearModal() { ModalUtils.close('confirmClearNotesModal', 'confirmClearNotesModalContent'); },

  async handleConfirmClearAll() {
    try {
      await db.clearAllRecords();
      this.closeConfirmClearModal();
      await this.loadNoteList();
      NotificationUtils.show('所有记录已成功清空', 'success');
    } catch (error) {
      console.error('清空记录失败:', error);
      NotificationUtils.show('清空记录失败，请重试', 'error');
    }
  },

  openConfirmDeleteNoteModal(id) {
    document.getElementById('confirmDeleteNote').dataset.id = id;
    ModalUtils.open('confirmDeleteNoteModal', 'confirmDeleteNoteModalContent');
  },

  closeConfirmDeleteNoteModal() {
    ModalUtils.close('confirmDeleteNoteModal', 'confirmDeleteNoteModalContent');
  },

  async handleConfirmDeleteNote() {
    const id = document.getElementById('confirmDeleteNote').dataset.id;
    const result = await NoteController.deleteNote(id);
    if (result) {
      this.closeConfirmDeleteNoteModal();
      await this.loadNoteList();
      NotificationUtils.show('删除成功', 'success');
    } else {
      NotificationUtils.show('删除失败', 'error');
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

  handleFilterChange() { this.loadNoteList(this.getCurrentFilterCriteria()); },

  handleSearchInput(e) {
    this.loadNoteList({ ...this.getCurrentFilterCriteria(), searchTerm: e.target.value });
  },

  getCurrentFilterCriteria() {
    const statusFilter = document.getElementById('statusFilter');
    const phaseFilter = document.getElementById('phaseFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const noteSearchInput = document.getElementById('noteSearchInput');

    return {
      status: statusFilter ? statusFilter.value : 'all',
      phase: phaseFilter ? phaseFilter.value : 'all',
      priority: priorityFilter ? priorityFilter.value : 'all',
      searchTerm: noteSearchInput ? noteSearchInput.value : ''
    };
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  const noteDateEl = document.getElementById('noteDate');
  if (noteDateEl) noteDateEl.value = formattedDate;

  await NoteUIController.init();
});
