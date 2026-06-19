(function () {
  'use strict';

  function updatePreview(container, src, altText) {
    if (!container) {
      return;
    }

    container.setAttribute('data-media-preview-src', src);
    container.setAttribute('data-media-preview-alt', altText || 'Preview image');

    var existingImage = container.querySelector('img');
    if (existingImage) {
      existingImage.src = src;
      existingImage.alt = altText || 'Preview image';
      return;
    }

    container.innerHTML = '';
    var image = document.createElement('img');
    image.src = src;
    image.alt = altText || 'Preview image';
    container.appendChild(image);
  }

  function previewSelectedFile(input, container, emptyMarkup) {
    if (!input || !container) {
      return;
    }

    var file = input.files && input.files[0];

    if (!file) {
      container.innerHTML = emptyMarkup || '<span>Select a file to preview it before upload.</span>';
      container.removeAttribute('data-media-preview-src');
      container.removeAttribute('data-media-preview-alt');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (event) {
      updatePreview(container, event.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  var editors = document.querySelectorAll('[data-rich-editor]');

  editors.forEach(function (editor) {
    var surface = editor.querySelector('[data-rich-editor-surface]');
    var source = editor.querySelector('[data-rich-editor-source]');
    var toolbar = editor.querySelector('[data-rich-editor-toolbar]');

    if (!surface || !source || !toolbar) {
      return;
    }

    editor.classList.add('is-enhanced');
    surface.innerHTML = source.value || '<p></p>';

    var syncSource = function () {
      source.value = surface.innerHTML;
    };

    toolbar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-command]');
      if (!button) {
        return;
      }

      event.preventDefault();
      surface.focus();

      var command = button.getAttribute('data-command');
      var value = button.getAttribute('data-value');

      if (command === 'formatBlock') {
        document.execCommand(command, false, value || 'p');
      } else {
        document.execCommand(command, false, value || null);
      }

      syncSource();
    });

    surface.addEventListener('input', syncSource);
    surface.addEventListener('blur', syncSource);

    var form = editor.closest('form');
    if (form) {
      form.addEventListener('submit', syncSource);
    }
  });

  var featuredImageInput = document.querySelector('[data-featured-image-input]');
  var featuredImagePreview = document.querySelector('[data-featured-image-preview]');

  if (featuredImageInput && featuredImagePreview) {
    featuredImageInput.addEventListener('change', function () {
      previewSelectedFile(featuredImageInput, featuredImagePreview, '<span>No image selected yet.</span>');
    });
  }

  var mediaUploadForm = document.querySelector('[data-media-upload-form]');
  var mediaUploadInput = document.querySelector('[data-media-upload-input]');
  var mediaUploadPreview = document.querySelector('[data-media-upload-preview]');

  if (mediaUploadInput && mediaUploadPreview) {
    mediaUploadInput.addEventListener('change', function () {
      previewSelectedFile(mediaUploadInput, mediaUploadPreview, '<span>Select a file to preview it before upload.</span>');
    });
  }

  if (mediaUploadForm && window.FormData && window.fetch) {
    mediaUploadForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var formData = new FormData(mediaUploadForm);
      fetch(mediaUploadForm.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.error || 'Unable to upload media.');
            }
            return payload;
          });
        })
        .then(function (payload) {
          var preview = document.querySelector('[data-media-upload-preview]');
          if (preview) {
            updatePreview(preview, payload.path, payload.filename);
          }

          var grid = document.querySelector('.media-grid');
          if (grid) {
            var emptyState = grid.querySelector('p');
            if (emptyState) {
              emptyState.remove();
            }

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'media-card';
            button.setAttribute('data-media-preview-src', payload.path);
            button.setAttribute('data-media-preview-alt', payload.filename);
            button.innerHTML = '<img src="' + payload.path + '" alt="' + payload.filename + '" /><span>' + payload.filename + '</span>';
            grid.prepend(button);
          }

          var success = document.querySelector('.form__success');
          var error = document.querySelector('.form__error');
          if (error) {
            error.classList.remove('show');
          }
          if (success) {
            success.textContent = 'Media uploaded successfully.';
            success.classList.add('show');
          }
          mediaUploadForm.reset();
        })
        .catch(function (error) {
          var success = document.querySelector('.form__success');
          var errorBox = document.querySelector('.form__error');
          if (success) {
            success.classList.remove('show');
          }
          if (errorBox) {
            errorBox.textContent = error.message;
            errorBox.classList.add('show');
          }
        });
    });
  }

  var mediaModal = document.querySelector('[data-media-modal]');
  var mediaModalImage = document.querySelector('[data-media-modal-image]');
  var mediaModalCaption = document.querySelector('[data-media-modal-caption]');

  function openMediaModal(src, caption) {
    if (!mediaModal || !mediaModalImage || !mediaModalCaption) {
      return;
    }

    mediaModalImage.src = src;
    mediaModalImage.alt = caption || 'Media preview';
    mediaModalCaption.textContent = caption || '';
    mediaModal.classList.add('is-open');
    mediaModal.setAttribute('aria-hidden', 'false');
  }

  function closeMediaModal() {
    if (!mediaModal || !mediaModalImage || !mediaModalCaption) {
      return;
    }

    mediaModal.classList.remove('is-open');
    mediaModal.setAttribute('aria-hidden', 'true');
    mediaModalImage.src = '';
    mediaModalCaption.textContent = '';
  }

  document.addEventListener('click', function (event) {
    var mediaTrigger = event.target.closest('[data-media-preview-src]');
    if (mediaTrigger) {
      openMediaModal(mediaTrigger.getAttribute('data-media-preview-src'), mediaTrigger.getAttribute('data-media-preview-alt'));
      return;
    }

    if (event.target.closest('[data-media-modal-close]')) {
      closeMediaModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMediaModal();
    }
  });
})();