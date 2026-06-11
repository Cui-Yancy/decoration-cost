/* 装修管家 - 通知系统 */
const NotificationUtils = {
  show(message, type = 'info') {
    console.log('[装修管家] ' + message);

    this.showToast(message, type);

    const importantActions = ['导出成功', '导出失败', '数据导入成功', '数据导入失败'];
    const shouldShowNotification = importantActions.some(action => message.includes(action));

    if (shouldShowNotification && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('装修管家', {
        body: message,
        icon: 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%234f46e5\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpath d=\'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\'/%3e%3cpolyline points=\'9 22 9 12 15 12 15 22\'/%3e%3c/svg%3e',
        tag: 'decoration-app'
      });
    }
  },

  showToast(message, type) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const normalizedType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    const iconClass = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      info: 'fa-info-circle'
    }[normalizedType];

    toast.className = `app-toast app-toast-${normalizedType}`;
    toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');

    const icon = document.createElement('i');
    icon.className = `fa ${iconClass} app-toast-icon`;
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'app-toast-message';
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      window.setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};
