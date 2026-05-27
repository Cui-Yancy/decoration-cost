/* 装修管家 - 模态框动画工具 */
const ModalUtils = {
  open(modalId, contentId) {
    const modal = document.getElementById(modalId);
    const content = contentId ? document.getElementById(contentId) : null;

    if (!modal) return;

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('opacity-100');
      if (content) {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
      }
    });
  },

  close(modalId, contentId, onClosed) {
    const modal = document.getElementById(modalId);
    const content = contentId ? document.getElementById(contentId) : null;

    if (!modal) return;

    modal.classList.remove('opacity-100');
    if (content) {
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
    }

    setTimeout(() => {
      modal.classList.add('hidden');
      if (onClosed) onClosed();
    }, 300);
  }
};
