/* 装修管家 - 图片上传处理 */
const ImageUpload = {
  handleImageFile(file, urlInput, previewTextElement) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      if (urlInput) urlInput.value = base64Data;
      if (previewTextElement) {
        previewTextElement.textContent = '已选择图片: ' + file.name;
        previewTextElement.classList.remove('hidden');
      }
    };
    reader.readAsDataURL(file);
  },

  setupImageUpload(prefix) {
    const imageUploadArea = document.getElementById(prefix + 'imageUploadArea');
    const imageFileInput = document.getElementById(prefix + 'imageInput');
    const imageUrl = document.getElementById(prefix + 'imageUrl');
    const imagePreviewText = document.getElementById(prefix + 'imagePreviewText');
    const selectImageButton = document.getElementById(prefix + 'selectImageButton');
    const deleteImageButton = document.getElementById(prefix + 'deleteImageButton');

    if (!imageUploadArea || !imageFileInput || !selectImageButton) return;

    imageUploadArea.setAttribute('tabindex', '0');
    imageUploadArea.setAttribute('aria-label', '图片粘贴区域，点击后按Ctrl+V粘贴图片');

    imageUploadArea.addEventListener('focus', () => {
      imageUploadArea.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
    });
    imageUploadArea.addEventListener('blur', () => {
      imageUploadArea.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
    });

    selectImageButton.addEventListener('click', () => imageFileInput.click());

    imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleImageFile(e.target.files[0], imageUrl, imagePreviewText);
        if (deleteImageButton) deleteImageButton.classList.remove('hidden');
      }
    });

    imageUploadArea.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image')) {
          this.handleImageFile(item.getAsFile(), imageUrl, imagePreviewText);
          if (deleteImageButton) deleteImageButton.classList.remove('hidden');
          break;
        }
      }
    });

    if (deleteImageButton) {
      deleteImageButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (imageUrl) imageUrl.value = '';
        if (imagePreviewText) imagePreviewText.classList.add('hidden');
        deleteImageButton.classList.add('hidden');
      });
    }
  }
};
